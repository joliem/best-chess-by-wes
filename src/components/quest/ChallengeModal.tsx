import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Challenge, Room } from "@/lib/quest";

type Props = {
  open: boolean;
  room: Room | null;
  challenge: Challenge | null;
  onResolve: (won: boolean) => void;
};

export function ChallengeModal({ open, room, challenge, onResolve }: Props) {
  const [picked, setPicked] = useState<number | null>(null);

  if (!room || !challenge) return null;

  const correct = picked !== null && picked === challenge.answer;

  return (
    <Dialog open={open}>
      <DialogContent className="border-frame bg-card text-center sm:max-w-md [&>button]:hidden">
        <DialogHeader className="items-center">
          <div className="text-6xl">{room.emoji || "🚪"}</div>
          <DialogTitle className="text-2xl">{room.name}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {challenge.flavor}
          </DialogDescription>
        </DialogHeader>

        <p className="my-2 text-xl font-bold text-torch">{challenge.prompt}</p>

        <div className="grid grid-cols-2 gap-2">
          {challenge.options.map((opt, i) => {
            const state =
              picked === null
                ? "idle"
                : i === challenge.answer
                  ? "right"
                  : i === picked
                    ? "wrong"
                    : "dim";
            return (
              <Button
                key={opt}
                variant="secondary"
                disabled={picked !== null}
                onClick={() => setPicked(i)}
                className={[
                  "h-12 text-base font-bold disabled:opacity-100",
                  state === "right" && "bg-jade text-background",
                  state === "wrong" && "bg-destructive text-destructive-foreground",
                  state === "dim" && "opacity-40",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {opt}
              </Button>
            );
          })}
        </div>

        {picked !== null && (
          <div className="mt-2 space-y-3">
            <p className="text-lg font-bold">
              {correct ? "⚔️ Victory! The room is yours." : "💥 Ouch! You lose a heart."}
            </p>
            <Button
              className="w-full"
              onClick={() => {
                setPicked(null);
                onResolve(correct);
              }}
            >
              Continue
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
