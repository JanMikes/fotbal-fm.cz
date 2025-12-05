import { sendEmailAsync } from './email';
import type { Tournament } from '@/types/tournament';
import type { Event } from '@/types/event';
import type { MatchResult, UserInfo } from '@/types/match-result';
import type { Comment } from '@/types/comment';
import type { User } from '@/types/user';

// ============== Helper Functions ==============

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
}

function formatAuthor(author?: UserInfo): string {
  if (!author) return 'Neznámý uživatel';
  const name = `${author.firstName || ''} ${author.lastName || ''}`.trim();
  return name || 'Neznámý uživatel';
}

function formatUserName(user: User): string {
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || user.email;
}

function formatMultilineText(text: string): string {
  return text.replace(/\n/g, '<br>');
}

function createEmailHtml(title: string, content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="cs">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #2563eb; font-size: 24px; margin-bottom: 20px; }
        h2 { color: #1e40af; font-size: 18px; margin-top: 20px; }
        .details { background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .detail-row { margin: 8px 0; }
        .label { font-weight: bold; color: #4b5563; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      ${content}
      <div class="footer">
        <p>Tato zpráva byla automaticky vygenerována systémem MFK FM.</p>
        <p>Prosím neodpovídejte na tento email.</p>
      </div>
    </body>
    </html>
  `;
}

// ============== Notification Functions ==============

/**
 * Notify about new user registration
 */
export function notifyUserRegistered(user: User): void {
  const subject = `Nový uživatel: ${formatUserName(user)}`;

  const content = `
    <h1>Nová registrace uživatele</h1>
    <div class="details">
      <div class="detail-row"><span class="label">Jméno:</span> ${user.firstName} ${user.lastName}</div>
      <div class="detail-row"><span class="label">Email:</span> ${user.email}</div>
      <div class="detail-row"><span class="label">Pozice:</span> ${user.jobTitle || 'Neuvedeno'}</div>
      <div class="detail-row"><span class="label">Datum registrace:</span> ${formatDate(user.createdAt)}</div>
    </div>
  `;

  sendEmailAsync({
    subject,
    html: createEmailHtml(subject, content),
  });
}

/**
 * Notify about tournament creation
 */
export function notifyTournamentCreated(
  tournament: Tournament,
  matchCount: number
): void {
  const subject = `Nový turnaj: ${tournament.name}`;

  const content = `
    <h1>Vytvořen nový turnaj</h1>
    <div class="details">
      <div class="detail-row"><span class="label">Název:</span> ${tournament.name}</div>
      <div class="detail-row"><span class="label">Kategorie:</span> ${tournament.category}</div>
      <div class="detail-row"><span class="label">Datum:</span> ${formatDate(tournament.dateFrom)}${tournament.dateTo ? ` - ${formatDate(tournament.dateTo)}` : ''}</div>
      ${tournament.location ? `<div class="detail-row"><span class="label">Místo:</span> ${tournament.location}</div>` : ''}
      <div class="detail-row"><span class="label">Počet zápasů:</span> ${matchCount}</div>
      <div class="detail-row"><span class="label">Vytvořil:</span> ${formatAuthor(tournament.author)}</div>
    </div>
    ${tournament.description ? `<h2>Popis</h2><p>${formatMultilineText(tournament.description)}</p>` : ''}
  `;

  sendEmailAsync({
    subject,
    html: createEmailHtml(subject, content),
  });
}

/**
 * Notify about tournament update
 */
export function notifyTournamentUpdated(
  tournament: Tournament,
  matchCount: number
): void {
  const subject = `Turnaj upraven: ${tournament.name}`;

  const content = `
    <h1>Turnaj byl upraven</h1>
    <div class="details">
      <div class="detail-row"><span class="label">Název:</span> ${tournament.name}</div>
      <div class="detail-row"><span class="label">Kategorie:</span> ${tournament.category}</div>
      <div class="detail-row"><span class="label">Datum:</span> ${formatDate(tournament.dateFrom)}${tournament.dateTo ? ` - ${formatDate(tournament.dateTo)}` : ''}</div>
      ${tournament.location ? `<div class="detail-row"><span class="label">Místo:</span> ${tournament.location}</div>` : ''}
      <div class="detail-row"><span class="label">Počet zápasů:</span> ${matchCount}</div>
      <div class="detail-row"><span class="label">Upravil:</span> ${formatAuthor(tournament.modifiedBy || tournament.author)}</div>
    </div>
  `;

  sendEmailAsync({
    subject,
    html: createEmailHtml(subject, content),
  });
}

/**
 * Notify about match result creation
 */
export function notifyMatchResultCreated(matchResult: MatchResult): void {
  const subject = `Nový výsledek: ${matchResult.homeTeam} ${matchResult.homeScore}:${matchResult.awayScore} ${matchResult.awayTeam}`;

  const content = `
    <h1>Přidán nový výsledek zápasu</h1>
    <div class="details">
      <div class="detail-row"><span class="label">Zápas:</span> ${matchResult.homeTeam} vs ${matchResult.awayTeam}</div>
      <div class="detail-row"><span class="label">Výsledek:</span> ${matchResult.homeScore} : ${matchResult.awayScore}</div>
      <div class="detail-row"><span class="label">Kategorie:</span> ${matchResult.category}</div>
      <div class="detail-row"><span class="label">Datum zápasu:</span> ${formatDate(matchResult.matchDate)}</div>
      ${matchResult.homeGoalscorers ? `<div class="detail-row"><span class="label">Střelci (domácí):</span> ${matchResult.homeGoalscorers}</div>` : ''}
      ${matchResult.awayGoalscorers ? `<div class="detail-row"><span class="label">Střelci (hosté):</span> ${matchResult.awayGoalscorers}</div>` : ''}
      <div class="detail-row"><span class="label">Přidal:</span> ${formatAuthor(matchResult.author)}</div>
    </div>
    ${matchResult.matchReport ? `<h2>Zápis ze zápasu</h2><p>${formatMultilineText(matchResult.matchReport)}</p>` : ''}
  `;

  sendEmailAsync({
    subject,
    html: createEmailHtml(subject, content),
  });
}

/**
 * Notify about match result update
 */
export function notifyMatchResultUpdated(matchResult: MatchResult): void {
  const subject = `Výsledek upraven: ${matchResult.homeTeam} ${matchResult.homeScore}:${matchResult.awayScore} ${matchResult.awayTeam}`;

  const content = `
    <h1>Výsledek zápasu byl upraven</h1>
    <div class="details">
      <div class="detail-row"><span class="label">Zápas:</span> ${matchResult.homeTeam} vs ${matchResult.awayTeam}</div>
      <div class="detail-row"><span class="label">Výsledek:</span> ${matchResult.homeScore} : ${matchResult.awayScore}</div>
      <div class="detail-row"><span class="label">Kategorie:</span> ${matchResult.category}</div>
      <div class="detail-row"><span class="label">Datum zápasu:</span> ${formatDate(matchResult.matchDate)}</div>
      <div class="detail-row"><span class="label">Upravil:</span> ${formatAuthor(matchResult.modifiedBy || matchResult.author)}</div>
    </div>
  `;

  sendEmailAsync({
    subject,
    html: createEmailHtml(subject, content),
  });
}

/**
 * Notify about event creation
 */
export function notifyEventCreated(event: Event): void {
  const subject = `Nová událost: ${event.name}`;

  const eventTypeLabel = event.eventType === 'nadcházející' ? 'Nadcházející' : 'Proběhlá';

  const content = `
    <h1>Vytvořena nová událost</h1>
    <div class="details">
      <div class="detail-row"><span class="label">Název:</span> ${event.name}</div>
      <div class="detail-row"><span class="label">Typ:</span> ${eventTypeLabel}</div>
      <div class="detail-row"><span class="label">Datum:</span> ${formatDate(event.dateFrom)}${event.dateTo ? ` - ${formatDate(event.dateTo)}` : ''}</div>
      ${event.eventTime ? `<div class="detail-row"><span class="label">Čas:</span> ${event.eventTime}${event.eventTimeTo ? ` - ${event.eventTimeTo}` : ''}</div>` : ''}
      ${event.requiresPhotographer ? `<div class="detail-row"><span class="label">Vyžaduje fotografa:</span> Ano</div>` : ''}
      <div class="detail-row"><span class="label">Vytvořil:</span> ${formatAuthor(event.author)}</div>
    </div>
    ${event.description ? `<h2>Popis</h2><p>${formatMultilineText(event.description)}</p>` : ''}
  `;

  sendEmailAsync({
    subject,
    html: createEmailHtml(subject, content),
  });
}

/**
 * Notify about event update
 */
export function notifyEventUpdated(event: Event): void {
  const subject = `Událost upravena: ${event.name}`;

  const eventTypeLabel = event.eventType === 'nadcházející' ? 'Nadcházející' : 'Proběhlá';

  const content = `
    <h1>Událost byla upravena</h1>
    <div class="details">
      <div class="detail-row"><span class="label">Název:</span> ${event.name}</div>
      <div class="detail-row"><span class="label">Typ:</span> ${eventTypeLabel}</div>
      <div class="detail-row"><span class="label">Datum:</span> ${formatDate(event.dateFrom)}${event.dateTo ? ` - ${formatDate(event.dateTo)}` : ''}</div>
      ${event.eventTime ? `<div class="detail-row"><span class="label">Čas:</span> ${event.eventTime}${event.eventTimeTo ? ` - ${event.eventTimeTo}` : ''}</div>` : ''}
      <div class="detail-row"><span class="label">Upravil:</span> ${formatAuthor(event.modifiedBy || event.author)}</div>
    </div>
  `;

  sendEmailAsync({
    subject,
    html: createEmailHtml(subject, content),
  });
}

/**
 * Notify about new comment
 */
export function notifyCommentAdded(
  comment: Comment,
  entityType: 'matchResult' | 'tournament' | 'event',
  entityName: string
): void {
  const entityTypeLabels = {
    matchResult: 'výsledek zápasu',
    tournament: 'turnaj',
    event: 'událost',
  };

  const subject = `Nový komentář k: ${entityName}`;

  const content = `
    <h1>Přidán nový komentář</h1>
    <div class="details">
      <div class="detail-row"><span class="label">Typ:</span> ${entityTypeLabels[entityType]}</div>
      <div class="detail-row"><span class="label">Entita:</span> ${entityName}</div>
      <div class="detail-row"><span class="label">Autor:</span> ${formatAuthor(comment.author)}</div>
      <div class="detail-row"><span class="label">Datum:</span> ${formatDate(comment.createdAt)}</div>
    </div>
    <h2>Obsah komentáře</h2>
    <p style="background-color: #fff; padding: 15px; border-left: 4px solid #2563eb; margin: 15px 0;">
      ${formatMultilineText(comment.content)}
    </p>
  `;

  sendEmailAsync({
    subject,
    html: createEmailHtml(subject, content),
  });
}
