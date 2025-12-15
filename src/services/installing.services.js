// installing.services.js
import axios from 'axios';
import loginInstance from './loginInstance.js';

export async function installingIntegration(instance, code, integrationData) {
  try {
    const loginData = await loginInstance(instance, code);

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
