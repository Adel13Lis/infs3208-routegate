from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)


@app.route('/weather')
def get_weather():
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)

    if not lat or not lng:
        return jsonify({"error": "Missing coordinates"}), 400

    try:
        response = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                'latitude': lat,
                'longitude': lng,
                'daily': 'temperature_2m_max,windspeed_10m_max,windgusts_10m_max,precipitation_sum',
                'forecast_days': 14
            },
            timeout=10
        )
        data = response.json()
        daily = data['daily']

        forecast = []
        for i in range(len(daily['time'])):
            forecast.append({
                'date': daily['time'][i],
                'temp': daily['temperature_2m_max'][i],
                'wind_speed': daily['windspeed_10m_max'][i],
                'wind_gusts': daily['windgusts_10m_max'][i],
                'precipitation': daily['precipitation_sum'][i]
            })

        return jsonify({'forecast': forecast})
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "Weather API failed"}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
