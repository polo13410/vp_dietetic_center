export const API_BASE_URL = "http://127.0.0.1:3000/hello";

export async function apiCall(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
    }
    return response.json();
}

export async function getById(id: string) {
    return apiCall(`/${id}`);
}

export async function getAll() {
    return apiCall("");
}

export async function postItem(id: string, name: string) {
    return apiCall("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
    });
}