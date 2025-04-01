import { useState } from "react";
import { getAll, getById, postItem } from "../../utils/api";

export default function DashboardPage() {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [items, setItems] = useState([]);
  const [item, setItem] = useState(null);

  const handleGetById = async () => {
    try {
      const result = await getById(id);
      setItem(result);
    } catch (error) {
      console.error(error);
    }
  };

  const handleGetAll = async () => {
    try {
      const result = await getAll();
      setItems(result);
    } catch (error) {
      console.error(error);
    }
  };

  const handlePostItem = async () => {
    try {
      const result = await postItem(id, name);
      console.log("Item posted:", result);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <main>
      <h1>Dashboard</h1>

      <section>
        <h2>Get Item by ID</h2>
        <input
          type="text"
          placeholder="Enter ID"
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
        <button onClick={handleGetById}>Get by ID</button>
        {item && <pre>{JSON.stringify(item, null, 2)}</pre>}
      </section>

      <section>
        <h2>Get All Items</h2>
        <button onClick={handleGetAll}>Get All</button>
        <ul>
          {items.map((item, index) => (
            <li key={index}>{JSON.stringify(item)}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Post Item</h2>
        <input
          type="text"
          placeholder="Enter ID"
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
        <input
          type="text"
          placeholder="Enter Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={handlePostItem}>Post Item</button>
      </section>
    </main>
  );
}
