import { Request } from "express";

// Extend Express Request interface to include user property
export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}
declare module "xss-clean" {
  import { RequestHandler } from "express";
  function xssClean(): RequestHandler;
  export = xssClean;
}
