CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"session_id" text,
	"user_sequence_number" integer DEFAULT 1 NOT NULL,
	"type" text NOT NULL,
	"image_path" text NOT NULL,
	"results" jsonb NOT NULL,
	"original_image_url" text,
	"analysis_image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"session_id" text,
	"username" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'user' NOT NULL,
	"category" text DEFAULT 'general',
	"created_at" timestamp DEFAULT now() NOT NULL
);
