// Dummy worker script for Cluster spawn tests
const timer = setTimeout(() => {}, 60000);
timer.unref();
process.on('SIGTERM', () => {
    clearTimeout(timer);
    process.exit(0);
});
