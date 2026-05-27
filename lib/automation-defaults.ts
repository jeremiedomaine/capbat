/** Valeurs par défaut si la table Supabase n’existe pas encore ou est vide. */

export const DEFAULT_AUTOMATION_MESSAGE =
  "Bonjour {{prenom}},\n\nPetit rappel concernant votre mariage du {{date_mariage}}. Votre solde restant est de {{solde_restant}}.\nNous restons disponibles si vous avez besoin d'informations complementaires.\n\nA bientot,\nL'equipe Guestflow"

export const DEFAULT_AUTOMATION_SUBJECT = "Rappel solde - mariage du {{date_mariage}}"

export const DEFAULT_POST_EVENT_AUTOMATION_MESSAGE =
  "Bonjour {{prenom}},\n\nNous esperons que votre mariage du {{date_mariage}} s'est deroule pour le mieux.\n\n[Ecrivez ici votre message personnalise apres l'evenement.]\n\nBien cordialement,\nL'equipe Guestflow"

export const DEFAULT_POST_EVENT_AUTOMATION_SUBJECT = "Suite a votre mariage du {{date_mariage}}"

/** Relance solde : J-30 avant la date d'événement. */
export const DEPOSIT_REMINDER_DAYS_BEFORE = 30

/** Message après mariage : J+3 après la date d'événement (mariages uniquement). */
export const POST_EVENT_REMINDER_DAYS_AFTER = 3

/** Heure fixe des relances (fuseau `AUTOMATION_TIMEZONE`, défaut Europe/Paris). Non modifiable dans l’app. */
export const FIXED_AUTOMATION_SEND_TIME = "09:00"

export const DEFAULT_AUTOMATION_SEND_TIME = FIXED_AUTOMATION_SEND_TIME
