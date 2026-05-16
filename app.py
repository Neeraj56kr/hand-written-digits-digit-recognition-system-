"""
Neural Digit Vision — Modern MNIST Digit Recognition Web App
Flask backend serving a premium UI with drawing canvas and file upload.
"""

import os
import base64
import io
import numpy as np
import cv2
import tensorflow as tf
from flask import Flask, render_template, request, jsonify
from PIL import Image

# ── App Setup ────────────────────────────────────────────────
app = Flask(__name__)

# Load the pre-trained ANN model once at startup
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Ann_model.keras")
model = tf.keras.models.load_model(MODEL_PATH)


# ── Helper ───────────────────────────────────────────────────
def preprocess_image(img_bytes: bytes) -> np.ndarray:
    """Convert raw image bytes → model-ready (1, 28, 28) float32 array."""
    image = Image.open(io.BytesIO(img_bytes)).convert("L")
    img = np.array(image)
    img = cv2.resize(img, (28, 28))
    img = 255 - img          # invert colours (MNIST: white digit on black bg)
    img = img / 255.0        # normalise to 0-1
    img = img.reshape(1, 28, 28)
    return img


# ── Routes ───────────────────────────────────────────────────
@app.route("/")
def index():
    """Serve the main frontend page."""
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():
    """
    Accept an image via:
      • JSON  { "image": "<base64 data-URL>" }   (from canvas)
      • File  multipart/form-data  field "file"   (from upload)
    Return predicted digit, confidence, and all probabilities.
    """
    try:
        img_bytes = None

        # ── Canvas base64 path ──
        if request.is_json:
            data = request.get_json()
            image_data = data.get("image", "")
            # strip data-URL header  "data:image/png;base64,…"
            if "," in image_data:
                image_data = image_data.split(",", 1)[1]
            img_bytes = base64.b64decode(image_data)

        # ── File upload path ──
        elif "file" in request.files:
            file = request.files["file"]
            img_bytes = file.read()

        if img_bytes is None:
            return jsonify({"error": "No image data received"}), 400

        img = preprocess_image(img_bytes)
        prediction = model.predict(img, verbose=0)
        probabilities = prediction[0].tolist()
        predicted_digit = int(np.argmax(probabilities))
        confidence = float(max(probabilities))

        return jsonify({
            "predicted_digit": predicted_digit,
            "confidence": round(confidence, 4),
            "probabilities": [round(p, 4) for p in probabilities],
        })

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ── Run ──────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)