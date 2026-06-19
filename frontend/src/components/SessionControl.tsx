import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/app/session";

/** Top-bar account control: shows the signed-in user and a sign-out button. */
export function SessionControl() {
  const session = useSession();
  if (!session.isAuthenticated) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:flex items-center gap-2">
        {session.picture ? (
          <img src={session.picture} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">
            {(session.name ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
        <span className="text-sm text-muted-foreground max-w-[10rem] truncate">{session.name ?? session.email}</span>
      </div>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={session.logout}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
