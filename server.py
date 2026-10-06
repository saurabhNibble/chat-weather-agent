import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import agent

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(
    title="Aetheris Weather & Intelligence Agent",
    description="Full-stack AI Agent combining ReAct Reasoning, Tavily Web Search, and WeatherStack Real-Time Telemetry",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class ChatRequest(BaseModel):
    message: str

class WeatherRequest(BaseModel):
    city: str


@app.get("/")
async def serve_index():
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(index_file)


@app.post("/api/chat")
async def handle_chat(req: ChatRequest):
    user_query = req.message.strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    result = agent.run_agent(user_query)
    return JSONResponse(content=result)


@app.get("/api/weather")
async def handle_weather(city: str = "New Delhi"):
    city_name = city.strip()
    if not city_name:
        raise HTTPException(status_code=400, detail="City name is required")
    data = agent.get_direct_weather(city_name)
    return JSONResponse(content=data)


@app.get("/api/health")
async def handle_health():
    return JSONResponse(content={
        "status": "online",
        "agent": "ReAct Multi-Tool Agent",
        "llm": "Groq Qwen 3.8 27B",
        "tools": [
            {"name": "get_weather", "description": "Real-time Weatherstack Meteorological API"},
            {"name": "tavily_search_results_json", "description": "Tavily Real-Time Web Intelligence"}
        ]
    })


# Mount static directory for CSS, JS, and assets
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*60)
    print(" 🚀 Aetheris Weather & Intelligence Agent UI")
    print(" Open in your browser: http://127.0.0.1:8000")
    print("="*60 + "\n")
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
