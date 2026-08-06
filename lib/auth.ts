import { NextAuthOptions } from "next-auth";
import type { User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password.");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user) {
          throw new Error("Invalid email or password.");
        }

        // ✅ Check if email is verified - SPECIFIC ERROR MESSAGE
        if (!user.emailVerified) {
          throw new Error("Please verify your email before logging in. Check your inbox for the verification link.");
        }

        if (user.status === "BLOCKED") {
          throw new Error("Your account has been suspended.");
        }

        // Check if account is pending approval (for vendors/organizers)
        if (user.status === "PENDING") {
          throw new Error("Your account is pending admin approval. Please wait for confirmation.");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!isPasswordValid) {
          throw new Error("Invalid email or password.");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as User;
        token.id = authUser.id;
        token.role = authUser.role;
        token.status = authUser.status;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.status = token.status;

        // ✅ SECURITY: Re-fetch the user's current role/status from the DB on
        // every session read. The JWT only records the role at sign-in, so
        // without this an admin could be demoted (or blocked) and still keep
        // their old privileges until the token expires.
        if (token.id) {
          try {
            const currentUser = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: { role: true, status: true },
            });
            if (currentUser) {
              session.user.role = currentUser.role;
              session.user.status = currentUser.status;
            }
          } catch {
            // Fall back to the token values if the lookup fails.
          }
        }
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
    signOut: "/",
    error: "/login", // This will show errors on login page
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};