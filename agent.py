import os
import certifi
import dotenv
from pathlib import Path
import requests
from langchain_groq import ChatGroq
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_core.tools import tool
from langchain.agents import create_react_agent, AgentExecutor
from langchain import hub

# Load Environment Variables from .env
BASE_DIR = Path(__file__).resolve().parent
env_path = BASE_DIR / ".env"
dotenv.load_dotenv(dotenv_path=env_path)

# Ensure SSL cert for certifi
os.environ["SSL_CERT_FILE"] = certifi.where()

# Read API keys supporting multiple naming conventions
tavily_api_key = os.getenv("tavily_api_key") or os.getenv("TAVILY_API_KEY")
groq_api_key = os.getenv("groq_api_key") or os.getenv("GROQ_API_KEY")
weather_api_key = os.getenv("weather_api_key") or os.getenv("WEATHER_API_KEY")
openapi_api_key = os.getenv("open_api_key") or os.getenv("OPENAI_API_KEY")

if tavily_api_key:
    os.environ["TAVILY_API_KEY"] = tavily_api_key
if groq_api_key:
    os.environ["GROQ_API_KEY"] = groq_api_key

# 1. Weather Tool (WeatherStack API)
@tool
def get_weather(city: str) -> str:
    """Get the current weather for a city.
    Use this tool when the user asks about weather,
    temperature, humidity, or weather conditions.
    The input must be a city name.
    """
    if not weather_api_key:
        return "Weather API Key not configured in .env"

    url = "https://api.weatherstack.com/current"
    params = {
        "access_key": weather_api_key,
        "query": city,
        "units": "m"
    }

    try:
        response = requests.get(url, params=params, timeout=12)
        response.raise_for_status()
        data = response.json()

        if "error" in data:
            error_info = data["error"].get("info", "Unknown error")
            return f"Unable to get weather for '{city}': {error_info}"

        location = data["location"]["name"]
        country = data["location"].get("country", "")
        temperature = data["current"]["temperature"]
        humidity = data["current"]["humidity"]
        weather_desc = data["current"]["weather_descriptions"]
        description = weather_desc[0] if weather_desc else "Clear"
        wind_speed = data["current"].get("wind_speed", "N/A")
        feels_like = data["current"].get("feelslike", temperature)

        return (
            f"Weather in {location}, {country}: {description}, "
            f"Temperature: {temperature}°C (Feels like: {feels_like}°C), "
            f"Humidity: {humidity}%, Wind Speed: {wind_speed} km/h"
        )
    except Exception as e:
        return f"Error retrieving weather for '{city}': {str(e)}"


# 2. Search Tool (Tavily Search)
search_tool = TavilySearchResults(max_results=2)

# 3. LLM (Groq Qwen 27B)
groq_llm = ChatGroq(
    model="qwen/qwen3.8-27b",
    temperature=0,
    api_key=groq_api_key
)

# 4. Agent Setup
prompt = hub.pull("hwchase17/react")
tools = [search_tool, get_weather]

agent = create_react_agent(
    llm=groq_llm,
    tools=tools,
    prompt=prompt
)

agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,
    return_intermediate_steps=True,
    handle_parsing_errors=True
)


def run_agent(user_query: str) -> dict:
    """Invokes the agent and formats the output and reasoning steps."""
    try:
        response = agent_executor.invoke({"input": user_query})
        
        intermediate_steps = []
        for action, observation in response.get("intermediate_steps", []):
            intermediate_steps.append({
                "tool": getattr(action, "tool", "Unknown Tool"),
                "tool_input": str(getattr(action, "tool_input", "")),
                "log": getattr(action, "log", "").strip(),
                "observation": str(observation).strip()
            })

        return {
            "success": True,
            "output": response.get("output", "No response generated."),
            "steps": intermediate_steps
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "output": f"An error occurred while executing the agent: {str(e)}",
            "steps": []
        }


def get_direct_weather(city: str) -> dict:
    """Direct weather lookup without LLM for fast widget telemetry."""
    if not weather_api_key:
        return {"error": "Weather API key not found"}
    url = "https://api.weatherstack.com/current"
    params = {"access_key": weather_api_key, "query": city, "units": "m"}
    try:
        res = requests.get(url, params=params, timeout=8).json()
        if "error" in res:
            return {"error": res["error"].get("info", "Failed to fetch weather")}
        loc = res["location"]
        cur = res["current"]
        return {
            "city": loc["name"],
            "country": loc.get("country", ""),
            "region": loc.get("region", ""),
            "temperature": cur["temperature"],
            "feelslike": cur.get("feelslike", cur["temperature"]),
            "humidity": cur["humidity"],
            "weather_description": cur["weather_descriptions"][0] if cur.get("weather_descriptions") else "Clear",
            "weather_icon": cur["weather_icons"][0] if cur.get("weather_icons") else None,
            "wind_speed": cur.get("wind_speed", 0),
            "uv_index": cur.get("uv_index", 0),
            "visibility": cur.get("visibility", 0)
        }
    except Exception as e:
        return {"error": str(e)}
