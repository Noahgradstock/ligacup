import { createFrontendApiProxyHandlers } from "@clerk/nextjs/server";

export const runtime = "edge";

const handlers = createFrontendApiProxyHandlers();

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
export const PATCH = handlers.PATCH;
