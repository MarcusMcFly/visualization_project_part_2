"""
etl_utils.py — utilidades compartidas por los notebooks de la Parte II.

Cubre:
- Localización e inventario de los ficheros de `datasets/raw/`.
- Lectura robusta de los CSV de sensor (delimitador F=`,` / T=`;`, encoding UTF-8).
- Scoring de los cuestionarios SDQ y SNAP-IV (con manejo de SDQ19 ausente).

Pensado para importarse desde los notebooks:

    import sys; sys.path.append("../src")
    import etl_utils as eu
"""
from __future__ import annotations

import os
import re
import glob
import json
import math
from collections import defaultdict

import pandas as pd

# --------------------------------------------------------------------------- #
# Rutas
# --------------------------------------------------------------------------- #
# Raíz del proyecto = carpeta padre de la que contiene este fichero (src/).
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(PROJECT_ROOT, "datasets", "raw")
DATA_OUT_DIR = os.path.join(PROJECT_ROOT, "docs", "data")

DEMOGRAPHIC_FILE = "Demographic and mental health data.csv"

# Reconciliación de IDs: typo del dataset. Los ficheros de sensor 'Z27' corresponden
# al participante 'Q27' del fichero demográfico (mismo nº, presencia excluyente).
ID_ALIASES = {"Z27": "Q27"}

# --------------------------------------------------------------------------- #
# Inventario de participantes y ficheros de sensor
# --------------------------------------------------------------------------- #
# Los ficheros de sensor se llaman {ID}_F.csv (fragmentos) o {ID}_T.csv (por hora).
_SENSOR_RE = re.compile(r"^(?P<pid>.+)_(?P<kind>[FT])\.csv$", re.IGNORECASE)


def list_sensor_files(raw_dir: str = RAW_DIR) -> dict[str, dict[str, str]]:
    """Devuelve {participant_id: {'F': path|None, 'T': path|None}}."""
    inv: dict[str, dict[str, str]] = defaultdict(lambda: {"F": None, "T": None})
    for path in glob.glob(os.path.join(raw_dir, "*.csv")):
        name = os.path.basename(path)
        if name == DEMOGRAPHIC_FILE:
            continue
        m = _SENSOR_RE.match(name)
        if not m:
            continue
        pid = ID_ALIASES.get(m.group("pid"), m.group("pid"))
        inv[pid][m.group("kind").upper()] = path
    return dict(sorted(inv.items()))


def detect_delimiter(path: str) -> str:
    """Detecta el separador leyendo la cabecera (F usa ',', T usa ';')."""
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        header = fh.readline()
    # csv.Sniffer es frágil con cabeceras largas; el conteo directo es fiable aquí.
    return ";" if header.count(";") > header.count(",") else ","


# --------------------------------------------------------------------------- #
# Columnas de sensor: lectura POR POSICIÓN
# --------------------------------------------------------------------------- #
# Las 58 columnas siguen el mismo orden en todos los ficheros, pero 4 ficheros _T
# (L51, T20, X31, Z7) tienen la cabecera corrupta (la letra 't' sustituida por
# espacio: 'location'->'loca ion', y accel X/Y/Z renombrados 'x','y','z'). Por eso
# leemos por índice de columna y asignamos nuestros alias, ignorando la cabecera real.
#
# alias -> índice de columna (0-based) en el layout canónico de 58 columnas.
SENSOR_COLS = {
    "time": 0,            # loggingTime(txt)
    "lat": 2,             # locationLatitude(WGS84)
    "lon": 3,             # locationLongitude(WGS84)
    "altitude": 4,        # locationAltitude(m)
    "speed": 5,           # locationSpeed(m/s)
    "acc_x": 13,          # accelerometerAccelerationX(G)
    "acc_y": 14,
    "acc_z": 15,
    "uacc_x": 23,         # motionUserAccelerationX(G)
    "uacc_y": 24,
    "uacc_z": 25,
    "activity": 40,       # activity(txt)
    "activity_conf": 41,  # activityActivityConfidence(Z)
    "steps": 44,          # pedometerNumberofSteps(N)
    "cadence": 47,        # pedometerCurrentCadence(steps/s)
    "distance_m": 48,     # pedometerDistance(m)
    "battery": 57,        # batteryLevel(R)
}
# Orden ascendente de posiciones y alias correspondientes (lo que devuelve usecols).
_POS_SORTED = sorted(SENSOR_COLS.values())
_ALIAS_BY_POS = {pos: alias for alias, pos in SENSOR_COLS.items()}
_ORDERED_ALIASES = [_ALIAS_BY_POS[p] for p in _POS_SORTED]

# Tipos: 'time' y 'activity' son texto; el resto numérico (float).
_STR_ALIASES = {"time", "activity"}
_DTYPES = {p: ("str" if _ALIAS_BY_POS[p] in _STR_ALIASES else "float64") for p in _POS_SORTED}


def read_sensor_csv(path: str, chunksize: int | None = None):
    """
    Lee un CSV de sensor seleccionando columnas POR POSICIÓN (robusto frente a
    cabeceras corruptas) con el delimitador correcto (F=`,` / T=`;`) y encoding UTF-8.

    - Devuelve un DataFrame con los alias de SENSOR_COLS.
    - chunksize: si se indica, devuelve un iterador de DataFrames (lectura por trozos),
      imprescindible para los ficheros _T (decenas de MB).
    """
    sep = detect_delimiter(path)
    reader = pd.read_csv(
        path,
        sep=sep,
        encoding="utf-8",
        header=0,                 # descarta la fila de cabecera (sea válida o corrupta)
        usecols=_POS_SORTED,      # selecciona por índice de columna
        names=range(58),          # ignora los nombres reales; usamos posiciones
        dtype=_DTYPES,
        na_values=["", "-9999"],  # centinela de location floor, etc.
        chunksize=chunksize,
        low_memory=False,
        on_bad_lines="skip",
    )

    def _fix(df: pd.DataFrame) -> pd.DataFrame:
        df.columns = _ORDERED_ALIASES
        return df

    if chunksize is None:
        return _fix(reader)
    return (_fix(chunk) for chunk in reader)


# --------------------------------------------------------------------------- #
# Cuestionarios: definición de subescalas
# --------------------------------------------------------------------------- #
# SDQ — items por subescala (numeración 1..25). OJO: SDQ19 no existe en el dataset.
SDQ_SUBSCALES = {
    "emotional": [3, 8, 13, 16, 24],
    "conduct": [5, 7, 12, 18, 22],
    "hyperactivity": [2, 10, 15, 21, 25],
    "peer": [6, 11, 14, 19, 23],          # 19 ausente -> se prorratea
    "prosocial": [1, 4, 9, 17, 20],
}
# Items invertidos en la escala SDQ estándar.
SDQ_REVERSE_ITEMS = {7, 11, 14, 21, 25}
SDQ_MAX_PER_ITEM = 2  # respuestas 0/1/2 (aquí codificadas 1/2/3, ver normalización)

# SNAP-IV
SNAP_SUBSCALES = {
    "inattention": list(range(1, 10)),        # a1..a9
    "hyperactivity_impulsivity": list(range(10, 19)),  # a10..a18
    "odd": list(range(19, 27)),               # a19..a26
}


def score_sdq(row: pd.Series) -> dict[str, float]:
    """
    Calcula las subescalas SDQ + total difficulties para una fila demográfica.

    Asume codificación 1/2/3 en el fichero; se reescala a 0/1/2 y se invierten
    los ítems reverse. La subescala 'peer' se prorratea por el nº de ítems
    presentes (SDQ19 falta).
    """
    scores: dict[str, float] = {}
    for sub, items in SDQ_SUBSCALES.items():
        vals, n = [], 0
        for it in items:
            col = f"SDQ{it}"
            if col not in row or pd.isna(row[col]):
                continue
            v = float(row[col]) - 1.0  # 1/2/3 -> 0/1/2
            if it in SDQ_REVERSE_ITEMS:
                v = SDQ_MAX_PER_ITEM - v
            vals.append(v)
            n += 1
        if n == 0:
            scores[sub] = float("nan")
        else:
            total = sum(vals)
            # Prorrateo si faltan ítems (p. ej. peer sin SDQ19): escala a 5 ítems.
            scores[sub] = total * len(items) / n
    # Total difficulties = suma de las 4 subescalas de dificultad (sin prosocial).
    # Si no hay NINGUNA subescala válida (participante sin cuestionario) -> NaN, no 0.
    diff = [scores[s] for s in ("emotional", "conduct", "hyperactivity", "peer")
            if pd.notna(scores[s])]
    scores["total_difficulties"] = sum(diff) if diff else float("nan")
    return scores


def score_snap(row: pd.Series) -> dict[str, float]:
    """Calcula las subescalas SNAP-IV (media por ítem) para una fila demográfica."""
    scores: dict[str, float] = {}
    for sub, items in SNAP_SUBSCALES.items():
        vals = [float(row[f"a{it}"]) for it in items
                if f"a{it}" in row and pd.notna(row[f"a{it}"])]
        scores[sub] = (sum(vals) / len(vals)) if vals else float("nan")
    return scores


def write_json(obj, filename: str, out_dir: str = DATA_OUT_DIR) -> str:
    """
    Escribe `obj` como JSON en docs/data/. Convierte NaN/inf en null (JSON válido
    que el navegador puede parsear) y redondea floats a 4 decimales para aligerar.
    """
    os.makedirs(out_dir, exist_ok=True)

    def clean(x):
        if isinstance(x, float):
            if math.isnan(x) or math.isinf(x):
                return None
            return round(x, 4)
        if isinstance(x, dict):
            return {k: clean(v) for k, v in x.items()}
        if isinstance(x, (list, tuple)):
            return [clean(v) for v in x]
        return x

    path = os.path.join(out_dir, filename)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(clean(obj), fh, ensure_ascii=False, separators=(",", ":"))
    size_kb = os.path.getsize(path) / 1024
    print(f"  escrito {filename}  ({size_kb:.1f} KB)")
    return path


def bmi_group(bmi: float) -> str:
    """Clasificación orientativa por BMI (rangos genéricos, no percentiles pediátricos)."""
    if pd.isna(bmi):
        return "unknown"
    if bmi < 15:
        return "underweight"
    if bmi < 19:
        return "normal"
    if bmi < 22:
        return "overweight"
    return "obesity"


# --------------------------------------------------------------------------- #
# Agregación de movimiento (streaming por chunks)
# --------------------------------------------------------------------------- #
import numpy as np  # noqa: E402

# Umbral de "actividad" sobre la magnitud de la aceleración de usuario (G).
ACTIVE_THR = 0.10
CHUNK = 250_000


def _circadian_phase(hour: int) -> str:
    if 5 <= hour < 12:
        return "morning"
    if 12 <= hour < 17:
        return "afternoon"
    if 17 <= hour < 21:
        return "evening"
    return "night"


def parse_time(s: pd.Series) -> pd.Series:
    """
    Parsea la columna de tiempo. La mayoría de ficheros usan ISO8601 con zona
    (`2024-04-10T17:25:05.358+08:00`); los 4 ficheros corruptos usan
    `DD/MM/YYYY HH:MM:SS.fff`. Cada fichero es homogéneo, así que probamos ISO y,
    si no parsea nada, caemos al formato day-first.
    """
    t = pd.to_datetime(s, format="ISO8601", errors="coerce", utc=False)
    if t.notna().sum() == 0:
        t = pd.to_datetime(s, dayfirst=True, errors="coerce")
    # Normaliza a naïve (quita tz) para poder extraer hora/día local sin avisos.
    try:
        if getattr(t.dt, "tz", None) is not None:
            t = t.dt.tz_localize(None)
    except (TypeError, AttributeError):
        pass
    return t


def _haversine_m(lat1, lon1, lat2, lon2) -> float:
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def aggregate_participant_movement(pid: str, files: dict[str, str]):
    """
    Agrega por streaming todos los ficheros de sensor (_F y _T) de un participante.

    Devuelve (daily_records, hourly_record, derived_record):
    - daily_records: lista de dicts (participant × día) con intensidad y actividad.
    - hourly_record: dict con la curva circadiana (24 medias de intensidad).
    - derived_record: dict (1 fila/participante) con features agregadas.

    La "intensidad" es la magnitud de la aceleración de usuario:
    sqrt(uacc_x² + uacc_y² + uacc_z²) en G — robusta frente al ruido del pedómetro.
    """
    # Acumuladores por día y por hora-del-día
    daily = defaultdict(lambda: {"n": 0, "sum_i": 0.0, "sumsq_i": 0.0,
                                  "active": 0, "sum_speed": 0.0, "n_speed": 0,
                                  "weekday": None})
    hourly = defaultdict(lambda: {"n": 0, "sum_i": 0.0})  # hour 0..23
    # Globales
    g = {"n": 0, "sum_i": 0.0, "sumsq_i": 0.0, "active": 0,
         "we_sum": 0.0, "we_n": 0, "wd_sum": 0.0, "wd_n": 0,
         "transitions": 0, "last_state": None,
         "lat_min": None, "lat_max": None, "lon_min": None, "lon_max": None}

    def process(chunk: pd.DataFrame):
        t = parse_time(chunk["time"])
        inten = np.sqrt(chunk["uacc_x"] ** 2 + chunk["uacc_y"] ** 2 + chunk["uacc_z"] ** 2)
        df = pd.DataFrame({
            "date": t.dt.date, "hour": t.dt.hour, "wday": t.dt.dayofweek,
            "i": inten, "speed": chunk["speed"], "lat": chunk["lat"], "lon": chunk["lon"],
        }).dropna(subset=["date", "i"])
        if df.empty:
            return
        active = df["i"] > ACTIVE_THR
        # --- transiciones (fragmentación) en orden de llegada ---
        states = active.astype(int).to_numpy()
        if g["last_state"] is not None and len(states):
            g["transitions"] += int(states[0] != g["last_state"])
        g["transitions"] += int((np.diff(states) != 0).sum())
        if len(states):
            g["last_state"] = int(states[-1])
        # --- globales ---
        g["n"] += len(df); g["sum_i"] += df["i"].sum(); g["sumsq_i"] += (df["i"] ** 2).sum()
        g["active"] += int(active.sum())
        we = df["wday"] >= 5
        g["we_sum"] += df.loc[we, "i"].sum(); g["we_n"] += int(we.sum())
        g["wd_sum"] += df.loc[~we, "i"].sum(); g["wd_n"] += int((~we).sum())
        # --- GPS bounding box (filtra centinelas) ---
        gps = df.dropna(subset=["lat", "lon"])
        gps = gps[(gps["lat"].between(-90, 90)) & (gps["lon"].between(-180, 180)) & (gps["lat"].abs() > 0.01)]
        if not gps.empty:
            for key, col, fn in [("lat_min", "lat", min), ("lat_max", "lat", max),
                                 ("lon_min", "lon", min), ("lon_max", "lon", max)]:
                v = gps[col].min() if fn is min else gps[col].max()
                g[key] = v if g[key] is None else fn(g[key], v)
        # --- por día ---
        for date, sub in df.groupby("date"):
            d = daily[date]
            d["n"] += len(sub); d["sum_i"] += sub["i"].sum(); d["sumsq_i"] += (sub["i"] ** 2).sum()
            d["active"] += int((sub["i"] > ACTIVE_THR).sum())
            sp = sub["speed"].where(sub["speed"] >= 0)  # -1 = sin GPS
            d["sum_speed"] += sp.sum(skipna=True); d["n_speed"] += int(sp.notna().sum())
            d["weekday"] = int(sub["wday"].iloc[0])
        # --- por hora del día ---
        for hr, sub in df.groupby("hour"):
            hourly[int(hr)]["n"] += len(sub); hourly[int(hr)]["sum_i"] += sub["i"].sum()

    for kind in ("F", "T"):
        path = files.get(kind)
        if not path:
            continue
        for chunk in read_sensor_csv(path, chunksize=CHUNK):
            process(chunk)

    if g["n"] == 0:
        return [], None, None

    # ----- daily_records -----
    daily_records = []
    for date, d in sorted(daily.items()):
        mean_i = d["sum_i"] / d["n"]
        daily_records.append({
            "participant_id": pid,
            "date": str(date),
            "weekday": d["weekday"],
            "weekend": d["weekday"] >= 5,
            "n_samples": d["n"],
            "mean_intensity": mean_i,
            "active_fraction": d["active"] / d["n"],
            "avg_speed": (d["sum_speed"] / d["n_speed"]) if d["n_speed"] else None,
        })

    # ----- hourly (curva circadiana) -----
    hours = []
    for h in range(24):
        hh = hourly.get(h)
        hours.append({
            "hour": h,
            "phase": _circadian_phase(h),
            "mean_intensity": (hh["sum_i"] / hh["n"]) if hh and hh["n"] else None,
            "n_samples": (hh["n"] if hh else 0),
        })
    hourly_record = {"participant_id": pid, "hours": hours}

    # ----- derived features (1 fila/participante) -----
    mean_i = g["sum_i"] / g["n"]
    var_i = max(g["sumsq_i"] / g["n"] - mean_i ** 2, 0.0)
    we_mean = (g["we_sum"] / g["we_n"]) if g["we_n"] else None
    wd_mean = (g["wd_sum"] / g["wd_n"]) if g["wd_n"] else None
    valid_hours = [h["mean_intensity"] for h in hours if h["mean_intensity"] is not None]
    mobility = None
    if None not in (g["lat_min"], g["lat_max"], g["lon_min"], g["lon_max"]):
        mobility = _haversine_m(g["lat_min"], g["lon_min"], g["lat_max"], g["lon_max"])
    derived_record = {
        "participant_id": pid,
        "n_samples": g["n"],
        "n_days": len(daily_records),
        "mean_intensity": mean_i,
        "accel_variance": var_i,
        "active_fraction": g["active"] / g["n"],
        "sedentary_fraction": 1 - g["active"] / g["n"],
        "activity_fragmentation": g["transitions"] / g["n"],
        "weekend_delta": ((we_mean - wd_mean) if (we_mean is not None and wd_mean is not None) else None),
        "circadian_stability": (1.0 / (1.0 + float(np.std(valid_hours))) if valid_hours else None),
        "peak_hour": (int(max(range(24), key=lambda h: hours[h]["mean_intensity"] or -1))
                      if valid_hours else None),
        "mobility_radius_m": mobility,
    }
    return daily_records, hourly_record, derived_record
