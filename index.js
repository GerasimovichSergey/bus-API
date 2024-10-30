import express from 'express';
import { readFile } from 'node:fs/promises';
import url from 'node:url';
import path from 'node:path';
import { DateTime } from 'luxon';


const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;
const timeZone = 'UTC';

const loadBuses = async () => {
    const data = await readFile(path.join(__dirname, 'buses.json'), 'utf-8');
    return JSON.parse(data);
};

const getNextDeparture = (firstDepartureTime, frequencyMinutes) => {
    const now = DateTime.now().setZone(timeZone);
    const endOfDay = DateTime.now().set({ hours: 23, minutes: 59, seconds: 59 }).setZone(timeZone);
    const [hours, minutes] = firstDepartureTime.split(':').map(n => Number(n));

    let departure = DateTime.now().set({ hours, minutes, seconds: 0, milliseconds: 0 }).setZone(timeZone);

    if (now > departure) {
        departure = departure.plus(frequencyMinutes);
    }

    if (departure > endOfDay) {
        departure = departure.startOf('day').plus({ days: 1 }).set({ hours, minutes });
    }

    while (now > departure) {
        departure = departure.plus({ minutes: frequencyMinutes });

        if (departure > endOfDay) {
            departure = departure.startOf('day').plus({ days: 1 }).set({ hours, minutes });
        }
    }

    return departure;
};

const sendUpdatedData = async () => {
    const buses = await loadBuses();

    const updateBuses = buses.map((bus) => {
        const nextDeparture = getNextDeparture(bus.firstDepartureTime, bus.frequencyMinutes);

        return {
            ...bus,
            nextDeparture: {
                date: nextDeparture.toFormat('yyyy-MM-dd'),
                time: nextDeparture.toFormat('HH:mm'),
            }
        }
    });

    return updateBuses;
};

const sortBusTime = ((bus1, bus2) => {
    const bus1InMillis = DateTime.fromISO(`${bus1.nextDeparture.date}T${bus1.nextDeparture.time}`).toMillis();
    const bus2InMillis = DateTime.fromISO(`${bus2.nextDeparture.date}T${bus2.nextDeparture.time}`).toMillis();

    return bus1InMillis - bus2InMillis;
});

app.get('/next-departure', async (req, res) => {
    try {
        const updatedBuses = await sendUpdatedData();
        const sortBuses = updatedBuses.sort(sortBusTime);

        res.send(sortBuses);
    } catch {
        res.send('Error');
    }
});

app.listen(port, () => {
    console.log(`Server run on port ${port}`);
});



