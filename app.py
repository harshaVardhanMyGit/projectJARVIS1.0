from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from dotenv import load_dotenv
from openai import OpenAI, AuthenticationError, RateLimitError, APIConnectionError
import os
import json

load_dotenv()

app = Flask(__name__)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Store conversation history per session (in-memory for simplicity)
conversation_history = []

SYSTEM_PROMPT = (
    "You are JARVIS, Tony Stark's sophisticated AI assistant. "
    "You are highly intelligent, polite, formal, and occasionally witty. "
    "Address the user as 'sir' or 'ma'am'. Provide precise, helpful responses "
    "with a touch of British elegance and subtle humor when appropriate."
)


def chatBot_stream(question):
    """Stream response from OpenAI word by word."""
    conversation_history.append({"role": "user", "content": question})

    try:
        stream = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                *conversation_history,
            ],
            max_tokens=500,
            temperature=0.3,
            stream=True,
        )

        full_response = ""
        for chunk in stream:
            if chunk.choices[0].delta.content:
                token = chunk.choices[0].delta.content
                full_response += token
                yield token

        conversation_history.append({"role": "assistant", "content": full_response})

    except AuthenticationError:
        yield "My apologies, sir. Authentication protocols have failed. Please verify your API key."
    except RateLimitError:
        yield "I'm afraid we've exceeded our operational limits, sir. Might I suggest we try again momentarily?"
    except APIConnectionError:
        yield "It appears I'm experiencing connectivity issues, sir. Please check your network connection."
    except Exception as e:
        yield f"Sir, I've encountered an unexpected error: {str(e)}"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/login")
def login():
    return render_template("login.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_message = data.get("message", "").strip()

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    def generate():
        for token in chatBot_stream(user_message):
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/clear", methods=["POST"])
def clear():
    """Clear conversation history."""
    conversation_history.clear()
    return jsonify({"status": "cleared"})


@app.route("/replay", methods=["POST"])
def replay():
    """Replay a message into conversation history (for loading saved chats)."""
    data = request.get_json()
    role = data.get("role", "")
    content = data.get("content", "")
    if role in ("user", "assistant") and content:
        conversation_history.append({"role": role, "content": content})
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
