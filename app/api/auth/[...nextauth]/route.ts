import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Pass your custom options into the core handler
const handler = NextAuth(authOptions);

// Export the handler for both HTTP GET and POST requests
export { handler as GET, handler as POST };


