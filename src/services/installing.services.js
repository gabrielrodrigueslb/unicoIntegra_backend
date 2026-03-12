import {
  authenticateInstance,
  postIvr,
} from './instanceApi.services.js';

export async function installingIntegration(
  instance,
  username,
  password,
  code,
  integrationData,
) {
  try {
    const token = await authenticateInstance(instance, username, password, code);
    const response = await postIvr(instance, integrationData, token);

    console.log('Integration installation successful:', response);
    return response;
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || error.response?.data || error.message;

    console.error('Falha detalhada:', errorMessage);
    throw new Error(JSON.stringify(errorMessage));
  }
}
