const interestModel = require('../models/interest');

const defaultInterests = [
  'Finance & Investing',
  'Technology & AI',
  'Health & Wellness',
  'Fitness & Exercise',
  'Mental Health',
  'Travel & Adventure',
  'Food & Cooking',
  'Gaming (Video Games, Esports)',
  'Movies & TV Shows',
  'Books & Literature',
  'Music & Concerts',
  'Entrepreneurship & Startups',
  'Cryptocurrency & Blockchain',
  'Sustainability & Environment',
  'Fashion & Beauty',
  'Sports (Football, Basketball, etc.)',
  'Self-Improvement & Productivity',
  'Relationships & Dating',
  'Art & Design'
];

async function populateInterests() {
  try {
    console.log('Populating interests table...');
    
    for (const interestName of defaultInterests) {
      try {
        await interestModel.createInterest(interestName);
        console.log(`✅ Added interest: ${interestName}`);
      } catch (error) {
        if (error.message.includes('duplicate key')) {
          console.log(`⏭️  Interest already exists: ${interestName}`);
        } else {
          console.error(`❌ Error adding interest ${interestName}:`, error.message);
        }
      }
    }
    
    console.log('✅ Interests population completed!');
    
    // Show all interests
    const allInterests = await interestModel.getAllInterests();
    console.log('\n📋 All interests in database:');
    allInterests.forEach((interest, index) => {
      console.log(`${index + 1}. ${interest.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error populating interests:', error);
  }
}

// Run the script
populateInterests(); 