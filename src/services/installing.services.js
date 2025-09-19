// installing.services.js
import axios from 'axios';

async function loginInstance(instance) {
  const postData = {
    username: 'rl--gabrielag',
    password: '@Caio0305',
    code: '',
    trusted: false,
  };

  const loginResponse = await axios.post(`${instance}/login`, postData, {
    headers: { 'Content-Type': 'application/json' },
  });

  console.log('Login successful:', loginResponse.data);
  return loginResponse.data;
}

export async function installingIntegration(instance, integrationData) {
  try {
    const loginData = await loginInstance(instance);

    const installResponse = await axios.post(
      `${instance}/ivrs/`,
      integrationData,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginData.token}`,
        },
      },
    );

    console.log('Integration installation successful:', installResponse.data);
    return installResponse.data;
  } catch (error) {
    console.error(
      'Login or installation failed:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
}
