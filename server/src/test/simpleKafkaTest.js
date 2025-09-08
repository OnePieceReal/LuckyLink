const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'luckylink-simple-test',
  brokers: ['localhost:9092'],
});

async function testProducer() {
  const producer = kafka.producer();
  
  try {
    await producer.connect();
    console.log('✅ Producer connected successfully');
    
    await producer.send({
      topic: 'friend-requests',
      messages: [
        { 
          value: JSON.stringify({
            type: 'test',
            message: 'Hello from Kafka producer!',
            timestamp: new Date().toISOString()
          })
        },
      ],
    });
    console.log('✅ Test message sent successfully');
    
    await producer.disconnect();
    console.log('✅ Producer disconnected');
    return true;
  } catch (error) {
    console.error('❌ Producer test failed:', error.message);
    return false;
  }
}

async function testConsumer() {
  const consumer = kafka.consumer({ groupId: 'simple-test-group' });
  
  try {
    await consumer.connect();
    console.log('✅ Consumer connected successfully');
    
    await consumer.subscribe({ topic: 'friend-requests', fromBeginning: true });
    console.log('✅ Consumer subscribed to topic');
    
    let messageReceived = false;
    const timeout = setTimeout(() => {
      if (!messageReceived) {
        console.log('❌ No message received within 10 seconds');
        consumer.disconnect();
      }
    }, 10000);
    
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        messageReceived = true;
        clearTimeout(timeout);
        console.log('✅ Message received:');
        console.log('   Topic:', topic);
        console.log('   Partition:', partition);
        console.log('   Value:', message.value.toString());
        await consumer.disconnect();
      },
    });
    
  } catch (error) {
    console.error('❌ Consumer test failed:', error.message);
    return false;
  }
}

// Test producer first
console.log('🚀 Testing Kafka Producer...');
testProducer().then(success => {
  if (success) {
    console.log('\n🚀 Testing Kafka Consumer...');
    testConsumer();
  }
}); 