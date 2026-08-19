import { f7 } from "framework7-vue";

export class QueryError extends Error {
  public status?: number;
  public data?: any;

  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = "QueryError";
    this.status = status;
    this.data = data;
  }
}

export const queryErrorHandler = (error: unknown): QueryError => {
  let message = "An unknown error occurred";
  let status: number | undefined;

  if (error instanceof QueryError) {
    return error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "object" && error !== null) {
    const objError = error as any;
    message =
      objError.message ||
      objError.error ||
      objError.response?.data?.message ||
      "An unknown error occurred";
    status =
      objError.status || objError.statusCode || objError.response?.status;
  } else {
    message = String(error);
  }

  console.error("Query Error:", message, status);

  // Framework7 Toast - Correct API as per user
  f7.toast
    .create({
      text: message,
      closeTimeout: 3000,
      cssClass: "error-toast",
    })
    .open();

  return new QueryError(message, status, error);
};
