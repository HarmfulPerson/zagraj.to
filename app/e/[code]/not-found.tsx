import { GuestMessage, QuestionIcon } from "@/components/guest/GuestMessage";

export default function GuestEventNotFound() {
  return (
    <GuestMessage icon={QuestionIcon} title="Nie ma takiej imprezy" testId="guest-not-found">
      <p>Sprawdź kod na plakacie albo zeskanuj kod QR jeszcze raz.</p>
    </GuestMessage>
  );
}
