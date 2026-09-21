import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    const { data: account, error } = await supabase
      .from("worker_accounts")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .single();

    if (error || !account) {
      return NextResponse.json(
        {
          success: false,
          message: "Username atau password salah.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      account,
    });

  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: "Server Error",
      },
      { status: 500 }
    );
  }
}