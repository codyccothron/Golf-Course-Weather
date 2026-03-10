const BASE_URL = 'https://api.open-meteo.com/v1/forecast?';
const WEATHER_QUERY = '&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_hours,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&hourly=temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code,cloud_cover,soil_temperature_0cm,wind_speed_10m,wind_speed_80m,wind_direction_10m,wind_direction_80m,wind_gusts_10m,soil_moisture_0_to_1cm,visibility,uv_index,is_day&current=temperature_2m,relative_humidity_2m,is_day,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,weather_code,cloud_cover&timezone=America%2FChicago&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch';

const LOCATIONS = [
    { name: 'Golden Eagle', lat: 36.1625, long: -85.4988 },
    { name: 'White Plains', lat: 36.1767, long: -85.450156 },
    { name: 'Southern Hills', lat: 36.1550, long: -85.6364 },
    { name: 'Bear Trace', lat: 35.95, long: -85.03 }
];

function getLocationKey(lat, long) {
    return `${Number(lat).toFixed(4)},${Number(long).toFixed(4)}`;
}

async function fetchWeather(lat, long) {
    const url = `${BASE_URL}latitude=${lat}&longitude=${long}${WEATHER_QUERY}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        throw new Error(`Open-Meteo request failed (${response.status}) for ${lat},${long}`);
    }

    return response.json();
}

async function main() {
    const locations = {};

    const responses = await Promise.all(
        LOCATIONS.map(async (course) => {
            const data = await fetchWeather(course.lat, course.long);
            return {
                key: getLocationKey(course.lat, course.long),
                name: course.name,
                data
            };
        })
    );

    for (const item of responses) {
        locations[item.key] = item.data;
    }

    const payload = {
        generatedAt: new Date().toISOString(),
        ttlMinutes: 15,
        source: 'open-meteo',
        locations
    };

    const fs = await import('node:fs/promises');
    await fs.writeFile('weather-cache.json', `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Updated weather-cache.json for ${responses.length} locations.`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
