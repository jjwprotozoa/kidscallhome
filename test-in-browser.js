// Copy and paste this ENTIRE block into browser console
// This gets the token from localStorage and tests the function

(async () => {
  try {
    // Get token from localStorage (Supabase stores it here)
    const supabaseAuthKey = Object.keys(localStorage).find(key => key.includes('supabase.auth.token'));
    if (!supabaseAuthKey) {
      console.error('❌ No auth token found. Please make sure you are logged in.');
      return;
    }
    
    const authData = JSON.parse(localStorage.getItem(supabaseAuthKey) || '{}');
    const token = authData?.access_token;
    
    if (!token) {
      console.error('❌ No access token found in localStorage');
      return;
    }
    
    console.log('✅ Token found:', token.substring(0, 20) + '...');
    
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0bWhvamJqZmFjb2NycG1zbG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODExMDIsImV4cCI6MjA3NDQ1NzEwMn0.i8cdSYaeY7u4YaDqGI_92KmMwEpyEYt3ZZ9GuKxXVPk';
    
    console.log('🧪 Testing function...\n');
    
    const response = await fetch('https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/create-customer-portal-session', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'apikey': anonKey
      },
      body: JSON.stringify({ 
        returnUrl: 'https://www.kidscallhome.com/parent/upgrade' 
      })
    });
    
    console.log('📊 Status:', response.status, response.statusText);
    const text = await response.text();
    console.log('📄 Response Body:', text);
    
    try {
      const json = JSON.parse(text);
      console.log('✅ Parsed JSON:', json);
      if (response.status === 200 && json.success) {
        console.log('🎉 SUCCESS! Function is working!');
        console.log('🔗 Portal URL:', json.url);
      } else if (response.status === 400) {
        console.log('⚠️ Business logic error:', json.error);
      } else {
        console.log('❌ Error response');
      }
    } catch (e) {
      console.log('⚠️ Response is not JSON');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();


