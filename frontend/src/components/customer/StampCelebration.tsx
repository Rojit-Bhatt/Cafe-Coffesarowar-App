import { Check, Gift, Ticket, Copy, ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

interface StampCelebrationProps {
  rewardTriggered: boolean;
  stampsEarned: number;
  stampsRequired?: number;
  rewardTitle: string;
  voucherCode?: string;
  copied?: boolean;
  onCopyCode?: () => void;
  onDone: () => void;
  doneLabel?: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
}

// The one animated moment every customer sees repeatedly, shared by the
// in-app scanner and the QR-link claim page. Every stamp gets this, not just
// the rare reward-completion — "stamp-claim physics": the badge pops in with
// a soft overshoot-then-settle bounce, mirroring a physical stamp landing.
export function StampCelebration({
  rewardTriggered,
  stampsEarned,
  stampsRequired,
  rewardTitle,
  voucherCode,
  copied,
  onCopyCode,
  onDone,
  doneLabel = "Done",
  onSecondary,
  secondaryLabel,
}: StampCelebrationProps) {
  const reduceMotion = useReducedMotion();
  const remaining = stampsRequired ? Math.max(0, stampsRequired - stampsEarned) : null;

  const badgeTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 280, damping: 14 };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={rewardTriggered ? "Reward earned" : "Stamp added"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#121212]/95 px-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm text-center text-[#EBE6DF]">
        <motion.div
          initial={reduceMotion ? false : { scale: 0 }}
          animate={{ scale: [0, 1.15, 1] }}
          transition={badgeTransition}
          className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: "var(--brand)" }}
        >
          {rewardTriggered ? (
            <Gift className="h-9 w-9 text-white" strokeWidth={1.5} />
          ) : (
            <Check className="h-9 w-9 text-white" strokeWidth={2} />
          )}
          <motion.span
            initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: reduceMotion ? 0 : 0.25, type: "spring", stiffness: 300, damping: 16 }}
            className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#EBE6DF] text-[var(--brand)]"
          >
            <Ticket className="h-4 w-4" strokeWidth={2} />
          </motion.span>
        </motion.div>

        <h2 className="mt-6 font-display text-3xl font-normal">
          {rewardTriggered ? "Congratulations!" : "Stamp added!"}
        </h2>

        {rewardTriggered ? (
          <p className="mt-2 text-sm text-[#A3A3A3]">
            You completed your card and earned a {rewardTitle} voucher!
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-[#A3A3A3]">
              You now have <span className="font-bold" style={{ color: "var(--inverse-primary,#F4BA9C)" }}>
                {stampsEarned} stamp{stampsEarned === 1 ? "" : "s"}
              </span>.
            </p>
            {remaining !== null && remaining > 0 && (
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#7A756E]">
                Just {remaining} more for a {rewardTitle}!
              </p>
            )}
          </>
        )}

        {rewardTriggered && voucherCode && (
          <div className="relative mt-8 overflow-hidden rounded-3xl border border-[#2D2D2D] bg-[#1A1A1A] p-6">
            <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider">
              <Ticket className="h-4 w-4" />
              <span>Voucher code</span>
            </div>
            <p className="mt-3 select-all font-mono text-2xl font-bold tracking-widest">{voucherCode}</p>
            {onCopyCode && (
              <button
                onClick={onCopyCode}
                className="stamp-interactive mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-white"
                style={{ background: "var(--brand)" }}
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied!" : "Copy code"}
              </button>
            )}
          </div>
        )}

        <div className="mt-10 flex flex-col gap-3">
          <button
            onClick={onDone}
            className="stamp-interactive flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-bold uppercase tracking-wider text-white"
            style={{ background: "var(--brand)" }}
          >
            {doneLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
          {onSecondary && secondaryLabel && (
            <button
              onClick={onSecondary}
              className="rounded-full border border-[#2D2D2D] bg-[#1A1A1A] py-3 text-xs font-bold uppercase tracking-widest text-[#EBE6DF] transition-colors hover:bg-[#EBE6DF] hover:text-black"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default StampCelebration;
