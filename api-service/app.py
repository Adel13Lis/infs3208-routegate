from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import pymysql
import os
import hashlib

app = Flask(__name__)
CORS(app)


def hash_password(password):
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()


DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', 'password'),
    'database': os.getenv('DB_NAME', 'routegate'),
    'cursorclass': pymysql.cursors.DictCursor
}

WEATHER_URL = os.getenv('WEATHER_SERVICE_URL', 'http://localhost:5001')


def get_db():
    return pymysql.connect(**DB_CONFIG)


@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    try:
        conn = get_db()
        cursor = conn.cursor()

        # Hash the password before comparing
        password_hash = hash_password(password)

        cursor.execute("""
            SELECT u.user_id, u.email, u.first_name, u.last_name, u.home_airport,
                   a.airport_name, a.city, a.country
            FROM users u
            LEFT JOIN airports a ON u.home_airport = a.airport_code
            WHERE u.email = %s AND u.password_hash = %s
        """, (email, password_hash))
        user = cursor.fetchone()
        cursor.close()
        conn.close()

        if user:
            return jsonify({
                'success': True,
                'user': {
                    'email': user['email'],
                    'name': user['first_name'] + ' ' + user['last_name'],
                    'airport': user['home_airport'],
                    'airport_name': user['airport_name']
                }
            })
        return jsonify({'success': False, 'error': 'Invalid login'}), 401
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/signup', methods=['POST'])
def signup():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    home_airport = data.get('home_airport')

    if not email or not password or not first_name or not last_name or not home_airport:
        return jsonify({'success': False, 'error': 'All fields required'}), 400

    import random
    random_num = random.randint(1000, 9999)
    username = f"{last_name.lower()}-{random_num}-{home_airport.lower()}"

    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT email FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'success': False, 'error': 'Email exists'}), 400

        # Hash the password before storing
        password_hash = hash_password(password)

        cursor.execute("""
            INSERT INTO users (username, email, password_hash, first_name, last_name, home_airport, role)
            VALUES (%s, %s, %s, %s, %s, %s, 'staff')
        """, (username, email, password_hash, first_name, last_name, home_airport))

        conn.commit()

        cursor.execute(
            "SELECT airport_name FROM airports WHERE airport_code = %s", (home_airport,))
        airport = cursor.fetchone()

        cursor.close()
        conn.close()

        return jsonify({
            'success': True,
            'user': {
                'email': email,
                'name': first_name + ' ' + last_name,
                'airport': home_airport,
                'airport_name': airport['airport_name'] if airport else ''
            }
        })
    except Exception as e:
        print(f"Signup error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/airports')
def get_airports():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT airport_code as code, airport_name as name, city, country, latitude as lat, longitude as lng FROM airports")
        airports = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(airports)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/all-flights', methods=['GET'])
def get_all_flights():
    try:
        from datetime import date, timedelta
        today = date.today()
        end_date = today + timedelta(days=20)

        origin_airport = request.args.get('origin_airport')

        conn = get_db()
        cursor = conn.cursor()

        if origin_airport:
            cursor.execute("""
                SELECT flight_id, flight_number, origin_airport, destination_airport,
                       departure_date, departure_time, arrival_date, arrival_time,
                       status, aircraft_type
                FROM flights
                WHERE departure_date BETWEEN %s AND %s
                  AND origin_airport = %s
                ORDER BY departure_date, departure_time
            """, (today, end_date, origin_airport))
        else:
            raise Exception("ERROR - No origin airport selected")

        flights = cursor.fetchall()
        cursor.close()
        conn.close()

        # Convert date and time objects to strings for JSON serialization
        for flight in flights:
            if flight.get('departure_date'):
                flight['departure_date'] = str(flight['departure_date'])
            if flight.get('departure_time'):
                flight['departure_time'] = str(flight['departure_time'])
            if flight.get('arrival_date'):
                flight['arrival_date'] = str(flight['arrival_date'])
            if flight.get('arrival_time'):
                flight['arrival_time'] = str(flight['arrival_time'])

        return jsonify(flights)
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/upcoming-flights', methods=['GET'])
def get_upcoming_flights():
    origin = request.args.get('origin')

    if not origin:
        return jsonify({'error': 'Origin required'}), 400

    try:
        from datetime import date, timedelta
        today = date.today()
        end_date = today + timedelta(days=14)

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT flight_id, flight_number, origin_airport, destination_airport,
                   departure_date, departure_time, arrival_date, arrival_time,
                   status, aircraft_type
            FROM flights
            WHERE origin_airport = %s
            AND departure_date BETWEEN %s AND %s
            ORDER BY departure_date, departure_time
        """, (origin, today, end_date))

        flights = cursor.fetchall()
        cursor.close()
        conn.close()

        # Convert date and time objects to strings for JSON serialization
        for flight in flights:
            if flight.get('departure_date'):
                flight['departure_date'] = str(flight['departure_date'])
            if flight.get('departure_time'):
                flight['departure_time'] = str(flight['departure_time'])
            if flight.get('arrival_date'):
                flight['arrival_date'] = str(flight['arrival_date'])
            if flight.get('arrival_time'):
                flight['arrival_time'] = str(flight['arrival_time'])

        return jsonify(flights)
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/calculate-flight', methods=['POST'])
def calculate_flight():
    flight_id = request.json.get('flight_id')

    if not flight_id:
        return jsonify({'error': 'flight_id required'}), 400

    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT f.*, 
                   o.latitude as origin_lat, o.longitude as origin_lng, 
                   o.airport_name as origin_name, o.city as origin_city, o.country as origin_country,
                   d.latitude as dest_lat, d.longitude as dest_lng, 
                   d.airport_name as dest_name, d.city as dest_city, d.country as dest_country
            FROM flights f
            JOIN airports o ON f.origin_airport = o.airport_code
            JOIN airports d ON f.destination_airport = d.airport_code
            WHERE f.flight_id = %s
        """, (flight_id,))

        flight = cursor.fetchone()
        cursor.close()
        conn.close()

        if not flight:
            return jsonify({'error': 'Flight not found'}), 404

        origin_weather_response = requests.get(
            f"{WEATHER_URL}/weather",
            params={'lat': flight['origin_lat'], 'lng': flight['origin_lng']},
            timeout=10
        )
        origin_weather_data = origin_weather_response.json()

        dest_weather_response = requests.get(
            f"{WEATHER_URL}/weather",
            params={'lat': flight['dest_lat'], 'lng': flight['dest_lng']},
            timeout=10
        )
        dest_weather_data = dest_weather_response.json()

        origin_weather = None
        dest_weather = None

        for day in origin_weather_data['forecast']:
            if day['date'] == str(flight['departure_date']):
                origin_weather = day
                break

        for day in dest_weather_data['forecast']:
            if day['date'] == str(flight['arrival_date']):
                dest_weather = day
                break

        if not origin_weather or not dest_weather:
            return jsonify({'error': 'Weather data not available'}), 404

        origin_wind = origin_weather.get('wind_gusts') or 0
        origin_rain = origin_weather.get('precipitation') or 0
        dest_wind = dest_weather.get('wind_gusts') or 0
        dest_rain = dest_weather.get('precipitation') or 0

        reasons = []

        if origin_wind > 80:
            reasons.append(
                f"Extreme wind gusts at departure ({round(origin_wind)} km/h)")
        if dest_wind > 80:
            reasons.append(
                f"Extreme wind gusts at destination ({round(dest_wind)} km/h)")
        if origin_rain > 80:
            reasons.append(
                f"Extreme rainfall at departure ({round(origin_rain, 1)} mm)")
        if dest_rain > 80:
            reasons.append(
                f"Extreme rainfall at destination ({round(dest_rain, 1)} mm)")

        if reasons:
            recommendation = 'CANCEL'
            reason = ' | '.join(reasons)
        else:
            reschedule_reasons = []

            if origin_wind > 65:
                reschedule_reasons.append(
                    f"Severe wind gusts at {flight['origin_city']} ({round(origin_wind)} km/h) - Potential storm conditions")
            if dest_wind > 65:
                reschedule_reasons.append(
                    f"Severe wind gusts at {flight['dest_city']}, {flight['dest_country']} ({round(dest_wind)} km/h) - Potential storm conditions")
            if origin_rain > 60:
                reschedule_reasons.append(
                    f"Heavy rainfall at {flight['origin_city']} ({round(origin_rain, 1)} mm) - Possible flooding")
            if dest_rain > 60:
                reschedule_reasons.append(
                    f"Heavy rainfall at {flight['dest_city']}, {flight['dest_country']} ({round(dest_rain, 1)} mm) - Possible flooding")

            if reschedule_reasons:
                recommendation = 'RESCHEDULE'
                reason = ' | '.join(reschedule_reasons)
            else:
                recommendation = 'OK'
                if origin_rain > 20 or dest_rain > 20 or origin_wind > 40 or dest_wind > 40:
                    reason = 'Weather conditions are acceptable for flight operations.'
                else:
                    reason = 'Excellent weather conditions at both locations.'

        return jsonify({
            'flight': {
                'flight_number': flight['flight_number'],
                'origin': flight['origin_airport'],
                'origin_name': flight['origin_name'],
                'origin_city': flight['origin_city'],
                'destination': flight['destination_airport'],
                'destination_name': flight['dest_name'],
                'destination_city': flight['dest_city'],
                'destination_country': flight['dest_country'],
                'departure_date': str(flight['departure_date']),
                'departure_time': str(flight['departure_time']),
                'arrival_date': str(flight['arrival_date']),
                'arrival_time': str(flight['arrival_time'])
            },
            'recommendation': recommendation,
            'reason': reason,
            'origin_weather': {
                'temp': origin_weather.get('temp'),
                'wind_speed': round(origin_weather.get('wind_speed') or 0),
                'wind_gusts': round(origin_wind),
                'precipitation': round(origin_rain, 1)
            },
            'dest_weather': {
                'temp': dest_weather.get('temp'),
                'wind_speed': round(dest_weather.get('wind_speed') or 0),
                'wind_gusts': round(dest_wind),
                'precipitation': round(dest_rain, 1)
            }
        })

    except Exception as e:
        print(f"Calculate error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/calculate-destination', methods=['POST'])
def calculate_destination():
    dest_code = request.json.get('destination')
    origin_code = request.json.get('origin', 'BNE')

    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT * FROM airports WHERE airport_code = %s", (origin_code,))
        origin = cursor.fetchone()

        cursor.execute(
            "SELECT * FROM airports WHERE airport_code = %s", (dest_code,))
        destination = cursor.fetchone()

        cursor.close()
        conn.close()

        if not origin or not destination:
            return jsonify({'error': 'Airport not found'}), 404

        origin_weather_response = requests.get(
            f"{WEATHER_URL}/weather",
            params={'lat': origin['latitude'], 'lng': origin['longitude']},
            timeout=10
        )
        origin_weather_data = origin_weather_response.json()

        dest_weather_response = requests.get(
            f"{WEATHER_URL}/weather",
            params={'lat': destination['latitude'],
                    'lng': destination['longitude']},
            timeout=10
        )
        dest_weather_data = dest_weather_response.json()

        results = []
        for i in range(min(len(origin_weather_data['forecast']), len(dest_weather_data['forecast']))):
            origin_day = origin_weather_data['forecast'][i]
            dest_day = dest_weather_data['forecast'][i]

            origin_wind = origin_day.get('wind_gusts') or 0
            origin_rain = origin_day.get('precipitation') or 0
            dest_wind = dest_day.get('wind_gusts') or 0
            dest_rain = dest_day.get('precipitation') or 0

            if origin_wind > 80 or origin_rain > 80 or dest_wind > 80 or dest_rain > 80:
                status = 'CANCEL'
                reason = 'Extreme weather - Operations unsafe'
            elif origin_wind > 65 or origin_rain > 60 or dest_wind > 65 or dest_rain > 60:
                status = 'RESCHEDULE'
                reason = 'Severe weather conditions detected'
            else:
                status = 'OK'
                if origin_wind > 40 or dest_wind > 40 or origin_rain > 20 or dest_rain > 20:
                    reason = 'Moderate conditions - Within safe limits'
                else:
                    reason = 'Favorable conditions'

            results.append({
                'date': origin_day['date'],
                'status': status,
                'origin_wind': round(origin_wind),
                'origin_rain': round(origin_rain, 1),
                'dest_wind': round(dest_wind),
                'dest_rain': round(dest_rain, 1),
                'reason': reason
            })

        return jsonify({
            'origin': {
                'code': origin['airport_code'],
                'name': origin['airport_name']
            },
            'destination': {
                'code': destination['airport_code'],
                'name': destination['airport_name'],
                'city': destination['city'],
                'country': destination['country']
            },
            'forecast': results
        })

    except Exception as e:
        print(f"Calculate destination error: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
