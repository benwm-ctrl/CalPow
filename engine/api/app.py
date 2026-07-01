"""
app.py — CalPow routing engine (stub mode).
Full terrain physics re-enabled once this stub proves the end-to-end flow.
"""
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.requests import Request
from starlette.responses import Response

app = FastAPI(title="CalPow Engine")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
}

@app.middleware("http")
async def cors(request: Request, call_next):
    if request.method == "OPTIONS":
        return Response(status_code=200, headers=CORS)
    resp = await call_next(request)
    for k, v in CORS.items():
        resp.headers[k] = v
    return resp


class RouteReq(BaseModel):
    start: list[float]
    end: list[float]


@app.get("/health")
def health():
    return {"status": "ok", "mode": "stub"}


@app.post("/route/auto")
def route_auto(req: RouteReq):
    mid = [(req.start[0] + req.end[0]) / 2,
           (req.start[1] + req.end[1]) / 2]
    return {
        "geometry": {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [req.start, mid, req.end],
                },
                "properties": {"stub": True},
            }],
        },
        "total_cost": 0.0,
        "n_cells": 3,
        "segment_stats": [],
        "forecast_applied": False,
        "live_context": {"stub": True},
    }
