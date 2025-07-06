export type MongoProjection<T> = {
  [K in keyof T]?: 0 | 1;
} & {
  _id?: 0 | 1;
};
