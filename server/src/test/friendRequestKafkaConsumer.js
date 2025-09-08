const { startConsumer } = require('../services/kafka');

startConsumer(event => {
  console.log('Friend request event:', event);
}); 