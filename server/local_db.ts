
import fs from 'fs';
import path from 'path';

const DB_FILE = path.resolve(__dirname, 'local_db.json');

// Ensure DB file exists
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
        users: {},
        companies: {}
    }, null, 2));
}

class DocumentReference {
    constructor(private collectionName: string, private id: string) { }

    async get() {
        const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
        const data = db[this.collectionName]?.[this.id];
        return {
            exists: !!data,
            data: () => data,
            id: this.id
        };
    }

    async set(data: Record<string, unknown>, options?: { merge: boolean }) {
        const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
        if (!db[this.collectionName]) db[this.collectionName] = {};

        if (options?.merge && db[this.collectionName][this.id]) {
            db[this.collectionName][this.id] = { ...db[this.collectionName][this.id], ...data };
        } else {
            db[this.collectionName][this.id] = data;
        }

        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        return { id: this.id };
    }
}

class Query {
    constructor(private collectionName: string, private field: string, private operator: string, private value: unknown) { }

    async get() {
        const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
        const collection = db[this.collectionName] || {};
        const docs = Object.values(collection).filter((item: unknown) => {
            const record = item as Record<string, unknown>;
            if (this.operator === '==') return record[this.field] === this.value;
            return false;
        });

        return {
            empty: docs.length === 0,
            docs: docs.map(data => ({
                data: () => data,
                id: (data as Record<string, unknown>).id as string
            }))
        };
    }
}

class CollectionReference {
    constructor(private name: string) { }

    doc(id: string) {
        return new DocumentReference(this.name, id);
    }

    where(field: string, operator: string, value: unknown) {
        return new Query(this.name, field, operator, value);
    }

    async get() {
        const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
        const collection = db[this.name] || {};
        const docs = Object.values(collection);
        return {
            empty: docs.length === 0,
            docs: docs.map(data => ({
                data: () => data,
                id: (data as Record<string, unknown>).id as string
            }))
        };
    }
}

const localDb = {
    collection: (name: string) => new CollectionReference(name)
};

export default localDb;
