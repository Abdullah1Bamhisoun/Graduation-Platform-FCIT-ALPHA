const app = require('./app');
const { PORT } = require('./config/env');

// Initialise Redis connection and BullMQ email worker eagerly
require('./config/redis').getRedisClient();
require('./services/queue.service');

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
