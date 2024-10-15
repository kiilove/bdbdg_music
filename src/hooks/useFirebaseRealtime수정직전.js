import { useState, useEffect } from "react";
import {
  get,
  ref,
  push,
  set,
  update,
  remove,
  onValue,
} from "firebase/database";
import { database } from "../firebase";

export function useFirebaseRealtimeQuery() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function getDocuments(collectionInfo) {
    try {
      setLoading(true);

      const dataRef = ref(database, collectionInfo);
      const snapshot = await get(dataRef);

      if (snapshot.exists()) {
        const documents = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data,
        }));

        setData(documents);
        setLoading(false);
        return documents;
      } else {
        setError({ message: "No documents found" });
        setData([]);
        setLoading(false);
        return [];
      }
    } catch (error) {
      console.error(error);
      setError(error);
      setLoading(false);
      return [];
    }
  }

  useEffect(() => {
    const dataRef = ref(database);
    const unsubscribe = onValue(dataRef, (snapshot) => {
      if (snapshot.exists()) {
        const documents = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data,
        }));

        setData(documents);
      } else {
        setData([]);
      }

      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    data,
    loading,
    error,
    getDocuments,
  };
}

export function useFirebaseRealtimeGetDocument() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function getDocument(collectionInfo) {
    try {
      setLoading(true);

      const dataRef = ref(database, `${collectionInfo}`);
      const snapshot = await get(dataRef);

      if (snapshot.exists()) {
        setData({ id: snapshot.key, ...snapshot.val() });
        setLoading(false);
        return { id: snapshot.key, ...snapshot.val() };
      } else {
        setError({ message: "Document does not exist" });
        setData(null);
        setLoading(false);
        return null;
      }
    } catch (error) {
      console.error(error);
      setError(error);
      setLoading(false);
      return null;
    }
  }

  return {
    data,
    loading,
    error,
    getDocument,
  };
}

export function useFirebaseRealtimeAddData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const addData = async (collectionInfo, newData, key = null) => {
    try {
      setLoading(true);

      let dataRef;
      if (key) {
        // If key is provided, use it
        dataRef = ref(database, `${collectionInfo}/${key}`);
        await set(dataRef, newData);
      } else {
        // If no key is provided, let Firebase generate it
        dataRef = push(ref(database, collectionInfo));
        await set(dataRef, newData);
      }

      const newId = dataRef.key;

      setData({ id: newId, ...newData });
      setLoading(false);
      return { id: newId, ...newData };
    } catch (error) {
      console.error(error);
      setError(error);
      setLoading(false);
      return null;
    }
  };

  return { data, loading, error, addData };
}

export function useFirebaseRealtimeUpdateData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateData = async (collectionInfo, newData, id = "noId") => {
    console.log(newData);
    try {
      setLoading(true);

      const dataRef = ref(database, collectionInfo);
      await set(dataRef, newData);

      setData({ id, ...newData });
      setLoading(false);
      return { id, ...newData };
    } catch (error) {
      console.error(error);
      setError(error);
      setLoading(false);
      return null;
    }
  };

  return { data, loading, error, updateData };
}

export function useFirebaseRealtimeDeleteData() {
  const [data, setData] = useState(null);

  const deleteData = async (collectionInfo) => {
    try {
      const dataRef = ref(database, `${collectionInfo}`);
      await remove(dataRef);

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  return { data, deleteData };
}
