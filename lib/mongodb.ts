import mongoose from "mongoose";

type MongooseCache = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalWithMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

const cached = globalWithMongoose.mongooseCache ?? {
  connection: null,
  promise: null
};

globalWithMongoose.mongooseCache = cached;

export async function connectToDatabase(): Promise<typeof mongoose | null> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) return null;

  if (cached.connection) return cached.connection;

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, { bufferCommands: false })
      .then((connection) => {
        cached.connection = connection;
        return connection;
      })
      .catch((error: unknown) => {
        cached.promise = null;
        throw error;
      });
  }

  return cached.promise;
}

export async function dbConnect(): Promise<typeof mongoose> {
  const connection = await connectToDatabase();
  if (!connection) throw new Error("MONGODB_URI missing");
  return connection;
}

export default dbConnect;
