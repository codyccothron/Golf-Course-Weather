//alert("I am working")
const WEATHER_REFRESH_MS = 15 * 60 * 1000;
const WEATHER_CACHE_PREFIX = 'weatherCache:';
const SHARED_WEATHER_CACHE_URL = './weather-cache.json';
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast?';
const OPEN_METEO_QUERY = '&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_hours,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&hourly=temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code,cloud_cover,soil_temperature_0cm,wind_speed_10m,wind_speed_80m,wind_direction_10m,wind_direction_80m,wind_gusts_10m,soil_moisture_0_to_1cm,visibility,uv_index,is_day&current=temperature_2m,relative_humidity_2m,is_day,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,weather_code,cloud_cover&timezone=America%2FChicago&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch';

let activeLocation = { lat: '36.1625', long: '-85.4988' };
let refreshTimerId = null;
let sharedWeatherPayload = null;
let sharedWeatherFetchedAt = 0;

function getLocationKey(strLat, strLong) {
    const lat = Number(strLat);
    const lon = Number(strLong);

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return `${lat.toFixed(4)},${lon.toFixed(4)}`;
    }

    return `${strLat},${strLong}`;
}

function getWeatherCacheKey(strLat, strLong) {
    return `${WEATHER_CACHE_PREFIX}${strLat},${strLong}`;
}

function getCachedWeather(strLat, strLong) {
    const cacheKey = getWeatherCacheKey(strLat, strLong);
    const rawCache = localStorage.getItem(cacheKey);

    if (!rawCache) {
        return null;
    }

    try {
        const parsedCache = JSON.parse(rawCache);
        const isFresh = Date.now() - parsedCache.timestamp < WEATHER_REFRESH_MS;
        return isFresh ? parsedCache.data : null;
    } catch (err) {
        localStorage.removeItem(cacheKey);
        return null;
    }
}

function setCachedWeather(strLat, strLong, weatherData) {
    const cacheKey = getWeatherCacheKey(strLat, strLong);
    localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data: weatherData
    }));
}

async function getSharedWeather(strLat, strLong, forceRefresh = false) {
    const now = Date.now();
    const needsRefetch =
        forceRefresh ||
        !sharedWeatherPayload ||
        (now - sharedWeatherFetchedAt > 2 * 60 * 1000);

    if (needsRefetch) {
        try {
            const refreshKey = Math.floor(Date.now() / 60000); // changes once a minute
            const response = await fetch(`${SHARED_WEATHER_CACHE_URL}?v=${refreshKey}`, {
                cache: 'no-store'
            });

            if (!response.ok) {
                return null;
            }

            sharedWeatherPayload = await response.json();
            sharedWeatherFetchedAt = now;
        } catch (err) {
            return null;
        }
    }

    if (!sharedWeatherPayload || !sharedWeatherPayload.locations) {
        return null;
    }

    const locationKey = getLocationKey(strLat, strLong);
    return sharedWeatherPayload.locations[locationKey] || null;
}

// Function to convert wind direction degrees to N/S/E/W
function getWindDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

// Function to get Weather Icons class based on weather code
function getWeatherIcon(weatherCode, isDay = true) {
    if([0,1].includes(weatherCode)) {
        return 'bi bi-brightness-high';
    }
    if([2,3].includes(weatherCode)) {
        return 'bi bi-cloud-sun';
    }
    if([45,48].includes(weatherCode)) {
        return 'bi bi-cloud-fog2';
    }
    if([51,53,55].includes(weatherCode)) {
        return 'bi bi-cloud-drizzle';
    }
    if([61,63,65].includes(weatherCode)) {
        return 'bi bi-cloud-rain-heavy';
    }
    if([71,73,75,77].includes(weatherCode)) {
        return 'bi bi-snow';
    }
    if([80,81,82].includes(weatherCode)) {
        return 'bi bi-cloud-rain';
    }
    if([85,86].includes(weatherCode)) {
        return 'bi bi-snow';
    }
    if([95,96,99].includes(weatherCode)) {
        return 'bi bi-cloud-lightning-rain';
    }
    return 'bi bi-brightness-high';
}

// Function to get icon color based on weather code
function getIconColor(weatherCode) {
    // Clear skies - gold (codes 0 and 1)
    if([0,1].includes(weatherCode)) {
        return '#FFD700'; // Gold
    }
    // Partly cloudy - light gray
    if([2,3].includes(weatherCode)) {
        return '#9CA3AF'; // Gray
    }
    // Fog - light gray
    if([45,48].includes(weatherCode)) {
        return '#9CA3AF'; // Gray
    }
    // Light rain/drizzle - light blue
    if([51,53,55].includes(weatherCode)) {
        return '#60A5FA'; // Light blue
    }
    // Rain - darker blue
    if([61,63,65].includes(weatherCode)) {
        return '#3B82F6'; // Blue
    }
    // Snow - light blue/cyan
    if([71,73,75,77,85,86].includes(weatherCode)) {
        return '#60A5FA'; // Light blue
    }
    // Rain showers - blue
    if([80,81,82].includes(weatherCode)) {
        return '#3B82F6'; // Blue
    }
    // Thunderstorms - indigo
    if([95,96,99].includes(weatherCode)) {
        return '#6366F1'; // Indigo
    }
    return '#FFD700'; // Default to gold
}

function showWeatherUnavailable() {
    document.querySelector('#lblCurrentTemp').innerHTML = '—';
    document.querySelector('#lblLow').innerHTML = '—';
    document.querySelector('#lblHigh').innerHTML = '—';
    document.querySelector('#lblIcon').innerHTML = '<i class="bi bi-cloud-slash" style="color: #9CA3AF;"></i>';
    document.querySelector('#txtDescription').innerHTML = `
        <p class="fw-bold text-center">Weather Unavailable</p>
        <p class="text-muted">Data is temporarily unavailable. Please check back shortly.</p>
    `;
    ['today','tomorrow','day3','day4','day5','day6','day7'].forEach(day => {
        document.querySelector(`#lblLow-${day}`).innerHTML = '—';
        document.querySelector(`#lblHigh-${day}`).innerHTML = '—';
        document.querySelector(`#lblIcon-${day}`).innerHTML = '<i class="bi bi-cloud-slash"></i>';
        document.querySelector(`#txtDescription-${day}`).innerHTML = '<p class="fw-bold">Unavailable</p>';
    });
    document.querySelector('#txtHumidityPct').innerHTML = '—';
    document.querySelector('#txtWindMPH').innerHTML = '—';
    document.querySelector('#txtWindGust').innerHTML = '—';
    document.querySelector('#txtDirection').innerHTML = '—';
    document.querySelector('#lblSunrise').innerHTML = '—';
    document.querySelector('#lblSunset').innerHTML = '—';
}

async function fetchWeatherFromAPI(strLat, strLong) {
    try {
        const url = `${OPEN_METEO_BASE}latitude=${strLat}&longitude=${strLong}${OPEN_METEO_QUERY}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        return response.json();
    } catch (err) {
        return null;
    }
}

async function getWeatherData(strLat, strLong, forceRefresh = false){
    let objData = null;

    if (!forceRefresh) {
        objData = getCachedWeather(strLat, strLong);
    }

    if (!objData) {
        objData = await getSharedWeather(strLat, strLong, forceRefresh);
    }

    if (!objData) {
        objData = await fetchWeatherFromAPI(strLat, strLong);
    }

    if (!objData) {
        showWeatherUnavailable();
        return;
    }

    setCachedWeather(strLat, strLong, objData);

        document.querySelector('#lblCurrentTemp').innerHTML = objData.current.temperature_2m + '°'
 
        let strMinTemp = objData.daily.temperature_2m_min[0] + '°'
        document.querySelector('#lblLow').innerHTML = strMinTemp
 
        let strMaxTemp = objData.daily.temperature_2m_max[0] + '°'
        document.querySelector('#lblHigh').innerHTML = strMaxTemp
 
        let strCurrentWeatherCode = objData.current.weather_code
        let iconColor = getIconColor(strCurrentWeatherCode);
        let weatherIcon = getWeatherIcon(strCurrentWeatherCode, true);
        
        // Check wind conditions
        let windSpeed = objData.current.wind_speed_10m;
        let windGusts = objData.current.wind_gusts_10m;
        let isHighWind = (windSpeed > 8 || windGusts > 10);
        
            if([0,1].includes(strCurrentWeatherCode)) {
                document.querySelector('#lblIcon').innerHTML = `<i class="${weatherIcon}" style="color: #FFD700;"></i>`
                let description = isHighWind ? 'High Winds - conditions otherwise perfect' : 'Perfect conditions for golf'
                document.querySelector('#txtDescription').innerHTML = `
                <p class="fw-bold text-center">Clear Skies</p>
                <p class="text-muted">${description}</p>
            `}
 
            else if([2,3].includes(strCurrentWeatherCode)) {
                document.querySelector('#lblIcon').innerHTML = `<i class="${weatherIcon}" style="color: #9CA3AF;"></i>`
                let description = isHighWind ? 'High Winds - could be problematic' : 'Great conditions for golf'
                document.querySelector('#txtDescription').innerHTML = `
                <p class="fw-bold text-center">Partly Cloudy</p>
                <p class="text-muted">${description}</p>
            `}
 
            else if([45,48].includes(strCurrentWeatherCode)) {
                document.querySelector('#lblIcon').innerHTML = `<i class="${weatherIcon}" style="color: #9CA3AF;"></i>`
                let description = isHighWind ? 'Challenging conditions - high winds' : 'Challenging conditions'
                document.querySelector('#txtDescription').innerHTML = `
                <p class="fw-bold text-center">Foggy</p>
                <p class="text-muted">${description}</p>
            `}
 
            else if([51,53,55].includes(strCurrentWeatherCode)) {
                document.querySelector('#lblIcon').innerHTML = `<i class="${weatherIcon}" style="color: #60A5FA;"></i>`
                document.querySelector('#txtDescription').innerHTML = `
                <p class="fw-bold text-center">Light Rain</p>
                <p class="text-muted">Manageable, bring rain gear</p>
            `}
 
            else if([61,63,65].includes(strCurrentWeatherCode)) {
                document.querySelector('#lblIcon').innerHTML = `<i class="${weatherIcon}" style="color: #3B82F6;"></i>`
                document.querySelector('#txtDescription').innerHTML = `
                <p class="fw-bold text-center">Rain</p>
                <p class="text-muted">Not ideal, consider rescheduling</p>
            `}
 
            else if([71,73,75,77].includes(strCurrentWeatherCode)) {
                document.querySelector('#lblIcon').innerHTML = `<i class="${weatherIcon}" style="color: #60A5FA;"></i>`
                document.querySelector('#txtDescription').innerHTML = `
                <p class="fw-bold text-center">Snow</p>
                <p class="text-muted">Course likely closed</p>
            `}
 
            else if([80,81,82].includes(strCurrentWeatherCode)) {
                document.querySelector('#lblIcon').innerHTML = `<i class="${weatherIcon}" style="color: #3B82F6;"></i>`
                document.querySelector('#txtDescription').innerHTML = `
                <p class="fw-bold text-center">Rain Showers</p>
                <p class="text-muted">Wet conditions expected</p>
            `}
 
            else if([85,86].includes(strCurrentWeatherCode)) {
                document.querySelector('#lblIcon').innerHTML = `<i class="${weatherIcon}" style="color: #60A5FA;"></i>`
                document.querySelector('#txtDescription').innerHTML = `
                <p class="fw-bold text-center">Snow Showers</p>
                <p class="text-muted">Course likely closed</p>
            `}
 
            else if([95,96,99].includes(strCurrentWeatherCode)) {
                document.querySelector('#lblIcon').innerHTML = `<i class="${weatherIcon}" style="color: #6366F1;"></i>`
                document.querySelector('#txtDescription').innerHTML = `
                <p class="fw-bold text-center">Thunderstorms</p>
                <p class="text-muted">Unsafe - do not play</p>
            `}

        //TODAY Card
        let strMinTempToday = objData.daily.temperature_2m_min[0] + '°'
        document.querySelector('#lblLow-today').innerHTML = strMinTempToday
 
        let strMaxTempToday = objData.daily.temperature_2m_max[0] + '°'
        document.querySelector('#lblHigh-today').innerHTML = strMaxTempToday
 
        let strWeatherCodeToday = objData.daily.weather_code[0]
        let iconColorToday = getIconColor(strWeatherCodeToday);
        let weatherIconToday = getWeatherIcon(strWeatherCodeToday, true);
            if([0,1].includes(strWeatherCodeToday)) {
                document.querySelector('#lblIcon-today').innerHTML = `<i class="${weatherIconToday}"></i>`
                document.querySelector('#txtDescription-today').innerHTML = '<p class="fw-bold">Clear Skies</p>'
            }
 
            else if([2,3].includes(strWeatherCodeToday)) {
                document.querySelector('#lblIcon-today').innerHTML = `<i class="${weatherIconToday}"></i>`
                document.querySelector('#txtDescription-today').innerHTML = '<p class="fw-bold">Partly Cloudy</p>'
            }
 
            else if([45,48].includes(strWeatherCodeToday)) {
                document.querySelector('#lblIcon-today').innerHTML = `<i class="${weatherIconToday}"></i>`
                document.querySelector('#txtDescription-today').innerHTML = '<p class="fw-bold">Foggy</p>'
            }
 
            else if([51,53,55].includes(strWeatherCodeToday)) {
                document.querySelector('#lblIcon-today').innerHTML = `<i class="${weatherIconToday}"></i>`
                document.querySelector('#txtDescription-today').innerHTML = '<p class="fw-bold">Light Rain</p>'
            }
 
            else if([61,63,65].includes(strWeatherCodeToday)) {
                document.querySelector('#lblIcon-today').innerHTML = `<i class="${weatherIconToday}"></i>`
                document.querySelector('#txtDescription-today').innerHTML = '<p class="fw-bold">Rain</p>'
            }
 
            else if([71,73,75,77].includes(strWeatherCodeToday)) {
                document.querySelector('#lblIcon-today').innerHTML = `<i class="${weatherIconToday}"></i>`
                document.querySelector('#txtDescription-today').innerHTML = '<p class="fw-bold">Snow</p>'
            }
 
            else if([80,81,82].includes(strWeatherCodeToday)) {
                document.querySelector('#lblIcon-today').innerHTML = `<i class="${weatherIconToday}"></i>`
                document.querySelector('#txtDescription-today').innerHTML = '<p class="fw-bold">Rain Showers</p>'
            }
 
            else if([85,86].includes(strWeatherCodeToday)) {
                document.querySelector('#lblIcon-today').innerHTML = `<i class="${weatherIconToday}"></i>`
                document.querySelector('#txtDescription-today').innerHTML = '<p class="fw-bold">Snow Showers</p>'
            }
 
            else if([95,96,99].includes(strWeatherCodeToday)) {
                document.querySelector('#lblIcon-today').innerHTML = `<i class="${weatherIconToday}"></i>`
                document.querySelector('#txtDescription-today').innerHTML = '<p class="fw-bold">Thunderstorms</p>'
            }
        
        //Tomorrow Card
        let strMinTempTomorrow = objData.daily.temperature_2m_min[1] + '°'
        document.querySelector('#lblLow-tomorrow').innerHTML = strMinTempTomorrow
 
        let strMaxTempTomorrow = objData.daily.temperature_2m_max[1] + '°'
        document.querySelector('#lblHigh-tomorrow').innerHTML = strMaxTempTomorrow
 
        let strWeatherCodeTomorrow = objData.daily.weather_code[1]
        let iconColorTomorrow = getIconColor(strWeatherCodeTomorrow);
        let weatherIconTomorrow = getWeatherIcon(strWeatherCodeTomorrow, true);
            if([0,1].includes(strWeatherCodeTomorrow)) {
                document.querySelector('#lblIcon-tomorrow').innerHTML = `<i class="${weatherIconTomorrow}"></i>`
                document.querySelector('#txtDescription-tomorrow').innerHTML = '<p class="fw-bold">Clear Skies</p>'
            }
 
            else if([2,3].includes(strWeatherCodeTomorrow)) {
                document.querySelector('#lblIcon-tomorrow').innerHTML = `<i class="${weatherIconTomorrow}"></i>`
                document.querySelector('#txtDescription-tomorrow').innerHTML = '<p class="fw-bold">Partly Cloudy</p>'
            }
 
            else if([45,48].includes(strWeatherCodeTomorrow)) {
                document.querySelector('#lblIcon-tomorrow').innerHTML = `<i class="${weatherIconTomorrow}"></i>`
                document.querySelector('#txtDescription-tomorrow').innerHTML = '<p class="fw-bold">Foggy</p>'
            }
 
            else if([51,53,55].includes(strWeatherCodeTomorrow)) {
                document.querySelector('#lblIcon-tomorrow').innerHTML = `<i class="${weatherIconTomorrow}"></i>`
                document.querySelector('#txtDescription-tomorrow').innerHTML = '<p class="fw-bold">Light Rain</p>'
            }
 
            else if([61,63,65].includes(strWeatherCodeTomorrow)) {
                document.querySelector('#lblIcon-tomorrow').innerHTML = `<i class="${weatherIconTomorrow}"></i>`
                document.querySelector('#txtDescription-tomorrow').innerHTML = '<p class="fw-bold">Rain</p>'
            }
 
            else if([71,73,75,77].includes(strWeatherCodeTomorrow)) {
                document.querySelector('#lblIcon-tomorrow').innerHTML = `<i class="${weatherIconTomorrow}"></i>`
                document.querySelector('#txtDescription-tomorrow').innerHTML = '<p class="fw-bold">Snow</p>'
            }
 
            else if([80,81,82].includes(strWeatherCodeTomorrow)) {
                document.querySelector('#lblIcon-tomorrow').innerHTML = `<i class="${weatherIconTomorrow}"></i>`
                document.querySelector('#txtDescription-tomorrow').innerHTML = '<p class="fw-bold">Rain Showers</p>'
            }
 
            else if([85,86].includes(strWeatherCodeTomorrow)) {
                document.querySelector('#lblIcon-tomorrow').innerHTML = `<i class="${weatherIconTomorrow}"></i>`
                document.querySelector('#txtDescription-tomorrow').innerHTML = '<p class="fw-bold">Snow Showers</p>'
            }
 
            else if([95,96,99].includes(strWeatherCodeTomorrow)) {
                document.querySelector('#lblIcon-tomorrow').innerHTML = `<i class="${weatherIconTomorrow}"></i>`
                document.querySelector('#txtDescription-tomorrow').innerHTML = '<p class="fw-bold">Thunderstorms</p>'
            }
        
        //Day 3 Card
        let strMinTempDay3 = objData.daily.temperature_2m_min[2] + '°'
        document.querySelector('#lblLow-day3').innerHTML = strMinTempDay3
 
        let strMaxTempDay3 = objData.daily.temperature_2m_max[2] + '°'
        document.querySelector('#lblHigh-day3').innerHTML = strMaxTempDay3
 
        let strWeatherCodeDay3 = objData.daily.weather_code[2]
        let iconColorDay3 = getIconColor(strWeatherCodeDay3);
        let weatherIconDay3 = getWeatherIcon(strWeatherCodeDay3, true);
            if([0,1].includes(strWeatherCodeDay3)) {
                document.querySelector('#lblIcon-day3').innerHTML = `<i class="${weatherIconDay3}"></i>`
                document.querySelector('#txtDescription-day3').innerHTML = '<p class="fw-bold">Clear Skies</p>'
            }
 
            else if([2,3].includes(strWeatherCodeDay3)) {
                document.querySelector('#lblIcon-day3').innerHTML = `<i class="${weatherIconDay3}"></i>`
                document.querySelector('#txtDescription-day3').innerHTML = '<p class="fw-bold">Partly Cloudy</p>'
            }
 
            else if([45,48].includes(strWeatherCodeDay3)) {
                document.querySelector('#lblIcon-day3').innerHTML = `<i class="${weatherIconDay3}"></i>`
                document.querySelector('#txtDescription-day3').innerHTML = '<p class="fw-bold">Foggy</p>'
            }
 
            else if([51,53,55].includes(strWeatherCodeDay3)) {
                document.querySelector('#lblIcon-day3').innerHTML = `<i class="${weatherIconDay3}"></i>`
                document.querySelector('#txtDescription-day3').innerHTML = '<p class="fw-bold">Light Rain</p>'
            }
 
            else if([61,63,65].includes(strWeatherCodeDay3)) {
                document.querySelector('#lblIcon-day3').innerHTML = `<i class="${weatherIconDay3}"></i>`
                document.querySelector('#txtDescription-day3').innerHTML = '<p class="fw-bold">Rain</p>'
            }
 
            else if([71,73,75,77].includes(strWeatherCodeDay3)) {
                document.querySelector('#lblIcon-day3').innerHTML = `<i class="${weatherIconDay3}"></i>`
                document.querySelector('#txtDescription-day3').innerHTML = '<p class="fw-bold">Snow</p>'
            }
 
            else if([80,81,82].includes(strWeatherCodeDay3)) {
                document.querySelector('#lblIcon-day3').innerHTML = `<i class="${weatherIconDay3}"></i>`
                document.querySelector('#txtDescription-day3').innerHTML = '<p class="fw-bold">Rain Showers</p>'
            }
 
            else if([85,86].includes(strWeatherCodeDay3)) {
                document.querySelector('#lblIcon-day3').innerHTML = `<i class="${weatherIconDay3}"></i>`
                document.querySelector('#txtDescription-day3').innerHTML = '<p class="fw-bold">Snow Showers</p>'
            }
 
            else if([95,96,99].includes(strWeatherCodeDay3)) {
                document.querySelector('#lblIcon-day3').innerHTML = `<i class="${weatherIconDay3}"></i>`
                document.querySelector('#txtDescription-day3').innerHTML = '<p class="fw-bold">Thunderstorms</p>'
            }
        
        //Day 4 Card
        let strMinTempDay4 = objData.daily.temperature_2m_min[3] + '°'
        document.querySelector('#lblLow-day4').innerHTML = strMinTempDay4
 
        let strMaxTempDay4 = objData.daily.temperature_2m_max[3] + '°'
        document.querySelector('#lblHigh-day4').innerHTML = strMaxTempDay4
 
        let strWeatherCodeDay4 = objData.daily.weather_code[3]
        let iconColorDay4 = getIconColor(strWeatherCodeDay4);
        let weatherIconDay4 = getWeatherIcon(strWeatherCodeDay4, true);
            if([0,1].includes(strWeatherCodeDay4)) {
                document.querySelector('#lblIcon-day4').innerHTML = `<i class="${weatherIconDay4}"></i>`
                document.querySelector('#txtDescription-day4').innerHTML = '<p class="fw-bold">Clear Skies</p>'
            }
 
            else if([2,3].includes(strWeatherCodeDay4)) {
                document.querySelector('#lblIcon-day4').innerHTML = `<i class="${weatherIconDay4}"></i>`
                document.querySelector('#txtDescription-day4').innerHTML = '<p class="fw-bold">Partly Cloudy</p>'
            }
 
            else if([45,48].includes(strWeatherCodeDay4)) {
                document.querySelector('#lblIcon-day4').innerHTML = `<i class="${weatherIconDay4}"></i>`
                document.querySelector('#txtDescription-day4').innerHTML = '<p class="fw-bold">Foggy</p>'
            }
 
            else if([51,53,55].includes(strWeatherCodeDay4)) {
                document.querySelector('#lblIcon-day4').innerHTML = `<i class="${weatherIconDay4}"></i>`
                document.querySelector('#txtDescription-day4').innerHTML = '<p class="fw-bold">Light Rain</p>'
            }
 
            else if([61,63,65].includes(strWeatherCodeDay4)) {
                document.querySelector('#lblIcon-day4').innerHTML = `<i class="${weatherIconDay4}"></i>`
                document.querySelector('#txtDescription-day4').innerHTML = '<p class="fw-bold">Rain</p>'
            }
 
            else if([71,73,75,77].includes(strWeatherCodeDay4)) {
                document.querySelector('#lblIcon-day4').innerHTML = `<i class="${weatherIconDay4}"></i>`
                document.querySelector('#txtDescription-day4').innerHTML = '<p class="fw-bold">Snow</p>'
            }
 
            else if([80,81,82].includes(strWeatherCodeDay4)) {
                document.querySelector('#lblIcon-day4').innerHTML = `<i class="${weatherIconDay4}"></i>`
                document.querySelector('#txtDescription-day4').innerHTML = '<p class="fw-bold">Rain Showers</p>'
            }
 
            else if([85,86].includes(strWeatherCodeDay4)) {
                document.querySelector('#lblIcon-day4').innerHTML = `<i class="${weatherIconDay4}"></i>`
                document.querySelector('#txtDescription-day4').innerHTML = '<p class="fw-bold">Snow Showers</p>'
            }
 
            else if([95,96,99].includes(strWeatherCodeDay4)) {
                document.querySelector('#lblIcon-day4').innerHTML = `<i class="${weatherIconDay4}"></i>`
                document.querySelector('#txtDescription-day4').innerHTML = '<p class="fw-bold">Thunderstorms</p>'
            }

        //Day 5 Card
        let strMinTempDay5 = objData.daily.temperature_2m_min[4] + '°'
        document.querySelector('#lblLow-day5').innerHTML = strMinTempDay5
 
        let strMaxTempDay5 = objData.daily.temperature_2m_max[4] + '°'
        document.querySelector('#lblHigh-day5').innerHTML = strMaxTempDay5
 
        let strWeatherCodeDay5 = objData.daily.weather_code[4]
        let iconColorDay5 = getIconColor(strWeatherCodeDay5);
        let weatherIconDay5 = getWeatherIcon(strWeatherCodeDay5, true);
            if([0,1].includes(strWeatherCodeDay5)) {
                document.querySelector('#lblIcon-day5').innerHTML = `<i class="${weatherIconDay5}"></i>`
                document.querySelector('#txtDescription-day5').innerHTML = '<p class="fw-bold">Clear Skies</p>'
            }
 
            else if([2,3].includes(strWeatherCodeDay5)) {
                document.querySelector('#lblIcon-day5').innerHTML = `<i class="${weatherIconDay5}"></i>`
                document.querySelector('#txtDescription-day5').innerHTML = '<p class="fw-bold">Partly Cloudy</p>'
            }
 
            else if([45,48].includes(strWeatherCodeDay5)) {
                document.querySelector('#lblIcon-day5').innerHTML = `<i class="${weatherIconDay5}"></i>`
                document.querySelector('#txtDescription-day5').innerHTML = '<p class="fw-bold">Foggy</p>'
            }
 
            else if([51,53,55].includes(strWeatherCodeDay5)) {
                document.querySelector('#lblIcon-day5').innerHTML = `<i class="${weatherIconDay5}"></i>`
                document.querySelector('#txtDescription-day5').innerHTML = '<p class="fw-bold">Light Rain</p>'
            }
 
            else if([61,63,65].includes(strWeatherCodeDay5)) {
                document.querySelector('#lblIcon-day5').innerHTML = `<i class="${weatherIconDay5}"></i>`
                document.querySelector('#txtDescription-day5').innerHTML = '<p class="fw-bold">Rain</p>'
            }
 
            else if([71,73,75,77].includes(strWeatherCodeDay5)) {
                document.querySelector('#lblIcon-day5').innerHTML = `<i class="${weatherIconDay5}"></i>`
                document.querySelector('#txtDescription-day5').innerHTML = '<p class="fw-bold">Snow</p>'
            }
 
            else if([80,81,82].includes(strWeatherCodeDay5)) {
                document.querySelector('#lblIcon-day5').innerHTML = `<i class="${weatherIconDay5}"></i>`
                document.querySelector('#txtDescription-day5').innerHTML = '<p class="fw-bold">Rain Showers</p>'
            }
 
            else if([85,86].includes(strWeatherCodeDay5)) {
                document.querySelector('#lblIcon-day5').innerHTML = `<i class="${weatherIconDay5}"></i>`
                document.querySelector('#txtDescription-day5').innerHTML = '<p class="fw-bold">Snow Showers</p>'
            }
 
            else if([95,96,99].includes(strWeatherCodeDay5)) {
                document.querySelector('#lblIcon-day5').innerHTML = `<i class="${weatherIconDay5}"></i>`
                document.querySelector('#txtDescription-day5').innerHTML = '<p class="fw-bold">Thunderstorms</p>'
            }

        //Day 6 Card
        let strMinTempDay6 = objData.daily.temperature_2m_min[5] + '°'
        document.querySelector('#lblLow-day6').innerHTML = strMinTempDay6
 
        let strMaxTempDay6 = objData.daily.temperature_2m_max[5] + '°'
        document.querySelector('#lblHigh-day6').innerHTML = strMaxTempDay6
 
        let strWeatherCodeDay6 = objData.daily.weather_code[5]
        let iconColorDay6 = getIconColor(strWeatherCodeDay6);
        let weatherIconDay6 = getWeatherIcon(strWeatherCodeDay6, true);
            if([0,1].includes(strWeatherCodeDay6)) {
                document.querySelector('#lblIcon-day6').innerHTML = `<i class="${weatherIconDay6}"></i>`
                document.querySelector('#txtDescription-day6').innerHTML = '<p class="fw-bold">Clear Skies</p>'
            }
 
            else if([2,3].includes(strWeatherCodeDay6)) {
                document.querySelector('#lblIcon-day6').innerHTML = `<i class="${weatherIconDay6}"></i>`
                document.querySelector('#txtDescription-day6').innerHTML = '<p class="fw-bold">Partly Cloudy</p>'
            }
 
            else if([45,48].includes(strWeatherCodeDay6)) {
                document.querySelector('#lblIcon-day6').innerHTML = `<i class="${weatherIconDay6}"></i>`
                document.querySelector('#txtDescription-day6').innerHTML = '<p class="fw-bold">Foggy</p>'
            }
 
            else if([51,53,55].includes(strWeatherCodeDay6)) {
                document.querySelector('#lblIcon-day6').innerHTML = `<i class="${weatherIconDay6}"></i>`
                document.querySelector('#txtDescription-day6').innerHTML = '<p class="fw-bold">Light Rain</p>'
            }
 
            else if([61,63,65].includes(strWeatherCodeDay6)) {
                document.querySelector('#lblIcon-day6').innerHTML = `<i class="${weatherIconDay6}"></i>`
                document.querySelector('#txtDescription-day6').innerHTML = '<p class="fw-bold">Rain</p>'
            }
 
            else if([71,73,75,77].includes(strWeatherCodeDay6)) {
                document.querySelector('#lblIcon-day6').innerHTML = `<i class="${weatherIconDay6}"></i>`
                document.querySelector('#txtDescription-day6').innerHTML = '<p class="fw-bold">Snow</p>'
            }
 
            else if([80,81,82].includes(strWeatherCodeDay6)) {
                document.querySelector('#lblIcon-day6').innerHTML = `<i class="${weatherIconDay6}"></i>`
                document.querySelector('#txtDescription-day6').innerHTML = '<p class="fw-bold">Rain Showers</p>'
            }
 
            else if([85,86].includes(strWeatherCodeDay6)) {
                document.querySelector('#lblIcon-day6').innerHTML = `<i class="${weatherIconDay6}"></i>`
                document.querySelector('#txtDescription-day6').innerHTML = '<p class="fw-bold">Snow Showers</p>'
            }
 
            else if([95,96,99].includes(strWeatherCodeDay6)) {
                document.querySelector('#lblIcon-day6').innerHTML = `<i class="${weatherIconDay6}"></i>`
                document.querySelector('#txtDescription-day6').innerHTML = '<p class="fw-bold">Thunderstorms</p>'
            }

        //Day 7 Card
        let strMinTempDay7 = objData.daily.temperature_2m_min[6] + '°'
        document.querySelector('#lblLow-day7').innerHTML = strMinTempDay7
 
        let strMaxTempDay7 = objData.daily.temperature_2m_max[6] + '°'
        document.querySelector('#lblHigh-day7').innerHTML = strMaxTempDay7
 
        let strWeatherCodeDay7 = objData.daily.weather_code[6]
        let iconColorDay7 = getIconColor(strWeatherCodeDay7);
        let weatherIconDay7 = getWeatherIcon(strWeatherCodeDay7, true);
            if([0,1].includes(strWeatherCodeDay7)) {
                document.querySelector('#lblIcon-day7').innerHTML = `<i class="${weatherIconDay7}"></i>`
                document.querySelector('#txtDescription-day7').innerHTML = '<p class="fw-bold">Clear Skies</p>'
            }
 
            else if([2,3].includes(strWeatherCodeDay7)) {
                document.querySelector('#lblIcon-day7').innerHTML = `<i class="${weatherIconDay7}"></i>`
                document.querySelector('#txtDescription-day7').innerHTML = '<p class="fw-bold">Partly Cloudy</p>'
            }
 
            else if([45,48].includes(strWeatherCodeDay7)) {
                document.querySelector('#lblIcon-day7').innerHTML = `<i class="${weatherIconDay7}"></i>`
                document.querySelector('#txtDescription-day7').innerHTML = '<p class="fw-bold">Foggy</p>'
            }
 
            else if([51,53,55].includes(strWeatherCodeDay7)) {
                document.querySelector('#lblIcon-day7').innerHTML = `<i class="${weatherIconDay7}"></i>`
                document.querySelector('#txtDescription-day7').innerHTML = '<p class="fw-bold">Light Rain</p>'
            }
 
            else if([61,63,65].includes(strWeatherCodeDay7)) {
                document.querySelector('#lblIcon-day7').innerHTML = `<i class="${weatherIconDay7}"></i>`
                document.querySelector('#txtDescription-day7').innerHTML = '<p class="fw-bold">Rain</p>'
            }
 
            else if([71,73,75,77].includes(strWeatherCodeDay7)) {
                document.querySelector('#lblIcon-day7').innerHTML = `<i class="${weatherIconDay7}"></i>`
                document.querySelector('#txtDescription-day7').innerHTML = '<p class="fw-bold">Snow</p>'
            }
 
            else if([80,81,82].includes(strWeatherCodeDay7)) {
                document.querySelector('#lblIcon-day7').innerHTML = `<i class="${weatherIconDay7}"></i>`
                document.querySelector('#txtDescription-day7').innerHTML = '<p class="fw-bold">Rain Showers</p>'
            }
 
            else if([85,86].includes(strWeatherCodeDay7)) {
                document.querySelector('#lblIcon-day7').innerHTML = `<i class="${weatherIconDay7}"></i>`
                document.querySelector('#txtDescription-day7').innerHTML = '<p class="fw-bold">Snow Showers</p>'
            }
 
            else if([95,96,99].includes(strWeatherCodeDay7)) {
                document.querySelector('#lblIcon-day7').innerHTML = `<i class="${weatherIconDay7}"></i>`
                document.querySelector('#txtDescription-day7').innerHTML = '<p class="fw-bold">Thunderstorms</p>'
            }

        let strHumidity = objData.current.relative_humidity_2m + '% Humidity'
        document.querySelector('#txtHumidityPct').innerHTML = strHumidity

        let strWindSpeed = objData.current.wind_speed_10m + 'mph'
        document.querySelector('#txtWindMPH').innerHTML = strWindSpeed

        let strWindGusts = objData.current.wind_gusts_10m + 'mph'
        document.querySelector('#txtWindGust').innerHTML = strWindGusts

        let windDegrees = objData.current.wind_direction_10m;
        let windCompass = getWindDirection(windDegrees);
        let strWindDirection = windCompass + ' (' + windDegrees + '°)'
        document.querySelector('#txtDirection').innerHTML = strWindDirection

        // Extract and format sunrise and sunset times
        let sunriseDateTime = objData.daily.sunrise[0];
        let sunsetDateTime = objData.daily.sunset[0];
        
        // Parse the ISO 8601 format (e.g., "2023-01-15T07:30")
        let sunriseTime = new Date(sunriseDateTime);
        let sunsetTime = new Date(sunsetDateTime);
        
        // Format times as HH:MM AM/PM
        let sunriseFormatted = sunriseTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        let sunsetFormatted = sunsetTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        
        document.querySelector('#lblSunrise').innerHTML = sunriseFormatted
        document.querySelector('#lblSunset').innerHTML = sunsetFormatted
}

function setActiveLocation(strLat, strLong) {
    activeLocation = { lat: String(strLat), long: String(strLong) };
}

function refreshActiveLocation(forceRefresh = false) {
    return getWeatherData(activeLocation.lat, activeLocation.long, forceRefresh);
}

function startWeatherAutoRefresh() {
    if (refreshTimerId) {
        clearInterval(refreshTimerId);
    }

    refreshTimerId = setInterval(() => {
        refreshActiveLocation(true);
    }, WEATHER_REFRESH_MS);
}

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        refreshActiveLocation(false);
    }
});
 
/*
// query selector to call get Weather on chagne
document.querySelector('#FavCourses').addEventListener('change', function(){
    if(document.querySelector('#FavCourses').value != 'None'){
        let strLat = document.querySelector('#FavCourses').options[document.querySelector('#FavCourses').selectedIndex].dataset.lat
        let strLong = document.querySelector('#FavCourses').options[document.querySelector('#FavCourses').selectedIndex].dataset.long
        setActiveLocation(strLat, strLong)
        refreshActiveLocation(false)
    }

})*/

// Default Location - Golden Eagle Golf Club
setActiveLocation('36.1625', '-85.4988');
refreshActiveLocation(false);
startWeatherAutoRefresh();
