import { handleLogin } from "@/lib/loginHandler";

export async function POST(request) {
  return handleLogin(request, "worker");
}
