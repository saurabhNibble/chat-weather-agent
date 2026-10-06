import os
import sys
import webbrowser
import uvicorn
from agent import agent_executor, get_weather, search_tool, run_agent
from server import app

if __name__ == "__main__":
    # If user passed arguments like `python app.py "What is the weather in Paris?"`, run in CLI mode
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        print(f"\n🔍 Executing query: {query}\n")
        res = run_agent(query)
        print("="*50)
        print("AGENT OUTPUT:")
        print(res.get("output"))
        print("="*50)
    else:
        print("\n" + "="*65)
        print(" 🚀 Aetheris Autonomous Weather & Web Intelligence Agent UI")
        print(" 🌐 Web UI Available at: http://127.0.0.1:8000")
        print(" 💡 Press CTRL+C in this terminal to stop the server.")
        print("="*65 + "\n")

        # Automatically open browser
        try:
            webbrowser.open("http://127.0.0.1:8000")
        except Exception:
            pass

        uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)