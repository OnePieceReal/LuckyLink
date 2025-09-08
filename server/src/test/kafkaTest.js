const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'luckylink-test',
  brokers: ['localhost:9092'],
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'test-group' });

async function testProducer() {
  try {
    await producer.connect();
    console.log('✅ Producer connected successfully');
    
    // Send a test message
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
  try {
    await consumer.connect();
    console.log('✅ Consumer connected successfully');
    
    await consumer.subscribe({ topic: 'friend-requests', fromBeginning: true });
    console.log('✅ Consumer subscribed to topic');
    
    let messageReceived = false;
    const timeout = setTimeout(() => {
      if (!messageReceived) {
        console.log('❌ No message received within 5 seconds');
        consumer.disconnect();
      }
    }, 5000);
    
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

async function runTests() {
  console.log('🚀 Starting Kafka validation tests...\n');
  
  // Test producer first
  console.log('1. Testing Producer...');
  const producerSuccess = await testProducer();
  
  if (producerSuccess) {
    console.log('\n2. Testing Consumer...');
    await testConsumer();
  } else {
    console.log('\n❌ Skipping consumer test due to producer failure');
  }
  
  console.log('\n🏁 Kafka validation complete!');
}

// Run the tests
runTests().catch(console.error); 