import axios from 'axios';

import loginInstance from './loginInstance.js';

export async function authenticateInstance(
  instance,
  username,
  password,
  code,
) {
  const loginData = await loginInstance(instance, username, password, code);
  return loginData.token;
}

function getInstanceHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function postToInstance(instance, endpoint, payload, token) {
  const response = await axios.post(`${instance}${endpoint}`, payload, {
    headers: getInstanceHeaders(token),
  });

  return response.data;
}

export function postIvr(instance, payload, token) {
  return postToInstance(instance, '/ivrs/', payload, token);
}

export function createAssistantItem(instance, payload, token) {
  return postToInstance(instance, '/assistants/createItem', payload, token);
}

export function updateAssistantItem(instance, payload, token) {
  return postToInstance(instance, '/assistants/updateItem', payload, token);
}
