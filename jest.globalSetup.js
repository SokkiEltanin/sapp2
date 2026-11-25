// Testy w strefie czasowej usera (2026-11-25): zmiana czasu w marcu/październiku i przełom
// roku liczą się tak samo jak na telefonie, niezależnie od strefy maszyny (CI = UTC).
module.exports = async () => { process.env.TZ = 'Europe/Warsaw'; };
