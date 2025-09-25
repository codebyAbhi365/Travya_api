import axios from "axios";


// Prefer env var for security; fallback to existing value if present
const GOOGLE_WEATHER_API_KEY = process.env.GOOGLE_WEATHER_API_KEY || process.env.WEATHER_API_KEY || "";

export async function getWeather(req, res) {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: "Coordinates required" });

    // 1) Try Google Weather if API key is set
    if (GOOGLE_WEATHER_API_KEY) {
        try {
            const url = `https://weather.googleapis.com/v1/weather:forecast?location=POINT(${lon} ${lat})&hourly_fields=temperature,humidity,weather_code&daily_fields=temperature_max,temperature_min,weather_code&key=${GOOGLE_WEATHER_API_KEY}`;
            const { data } = await axios.get(url);

            const current = data?.current || data?.realtime || {};
            const hourly = data?.hourly || {};
            const daily = data?.daily || {};

            const temperature = current.temperature ?? hourly.temperature?.[0] ?? null;
            const humidity = current.humidity ?? hourly.humidity?.[0] ?? null;
            const condition = (current.weather_code ?? hourly.weather_code?.[0] ?? "Unknown").toString();

            // Process daily forecast data
            const dailyForecast = [];
            if (daily.time && daily.time.length > 0) {
                for (let i = 0; i < daily.time.length; i++) {
                    dailyForecast.push({
                        date: daily.time[i],
                        maxTemp: daily.temperature_max?.[i],
                        minTemp: daily.temperature_min?.[i],
                        weatherCode: daily.weather_code?.[i],
                        precipitationChance: null // Google API doesn't provide this in basic tier
                    });
                }
            }

            if (temperature != null && humidity != null) {
                return res.json({ 
                    weather: { 
                        current: { temperature, humidity, condition },
                        daily: dailyForecast
                    } 
                });
            }
            // If Google response is missing fields, fall through to fallback
        } catch (err) {
            console.error("Google Weather fetch failed:", err?.response?.data || err.message);
            // continue to fallback
        }
    }

    // 2) Fallback to Open-Meteo (no key)
    try {
        const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&forecast_days=7`;
        const { data } = await axios.get(omUrl);
        const current = data?.current || {};
        const daily = data?.daily || {};
        
        // Process daily forecast data
        const dailyForecast = [];
        if (daily.time && daily.time.length > 0) {
            for (let i = 0; i < daily.time.length; i++) {
                dailyForecast.push({
                    date: daily.time[i],
                    maxTemp: daily.temperature_2m_max[i],
                    minTemp: daily.temperature_2m_min[i],
                    weatherCode: daily.weather_code[i],
                    precipitationChance: daily.precipitation_probability_max[i]
                });
            }
        }
        
        const weather = {
            current: {
                temperature: current.temperature_2m,
                humidity: current.relative_humidity_2m,
                condition: String(current.weather_code ?? "Unknown"),
            },
            daily: dailyForecast
        };
        return res.json({ weather });
    } catch (err) {
        const status = err?.response?.status || 500;
        const details = err?.response?.data || err.message;
        console.error("Fallback weather fetch failed:", details);
        return res.status(status).json({ error: "Error fetching weather", details });
    }
}