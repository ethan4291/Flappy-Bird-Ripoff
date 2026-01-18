import pygame
import sys
import random
import os

pygame.init()

# Window
SCREEN_W, SCREEN_H = 400, 600
screen = pygame.display.set_mode((SCREEN_W, SCREEN_H))
pygame.display.set_caption("Flappy Bird Ripoff")
clock = pygame.time.Clock()
FPS = 60

# Game variables
GRAVITY = 0.45
FLAP_STRENGTH = -8
PIPE_SPEED = 2.5
PIPE_GAP = 150
PIPE_FREQ = 1500  # milliseconds

font = pygame.font.SysFont(None, 36)
big_font = pygame.font.SysFont(None, 64)

# Asset paths
ASSET_ROOT = os.path.join(os.path.dirname(__file__), 'data')
IMG_ROOT = os.path.join(ASSET_ROOT, 'img')
SOUND_ROOT = os.path.join(ASSET_ROOT, 'sound')

# Load assets with fallbacks
def load_image(path, convert_alpha=True):
    try:
        img = pygame.image.load(path)
        return img.convert_alpha() if convert_alpha else img.convert()
    except Exception:
        return None

def load_sound(path):
    try:
        return pygame.mixer.Sound(path)
    except Exception:
        return None

# Images
bg_img = load_image(os.path.join(IMG_ROOT, 'sprites', 'background-day.png'), convert_alpha=False)
base_img = load_image(os.path.join(IMG_ROOT, 'sprites', 'base.png'))
pipe_img = load_image(os.path.join(IMG_ROOT, 'sprites', 'pipe-green.png'))
bird_frames = []
for fname in ('yellowbird-upflap.png', 'yellowbird-midflap.png', 'yellowbird-downflap.png'):
    img = load_image(os.path.join(IMG_ROOT, 'bird', fname))
    if img:
        bird_frames.append(img)

# Sounds
sound_wing = load_sound(os.path.join(SOUND_ROOT, 'wing.wav')) or load_sound(os.path.join(SOUND_ROOT, 'wing.ogg'))
sound_point = load_sound(os.path.join(SOUND_ROOT, 'point.wav')) or load_sound(os.path.join(SOUND_ROOT, 'point.ogg'))
sound_hit = load_sound(os.path.join(SOUND_ROOT, 'hit.wav')) or load_sound(os.path.join(SOUND_ROOT, 'hit.ogg'))
sound_die = load_sound(os.path.join(SOUND_ROOT, 'die.wav')) or load_sound(os.path.join(SOUND_ROOT, 'die.ogg'))
sound_swoosh = load_sound(os.path.join(SOUND_ROOT, 'swoosh.wav')) or load_sound(os.path.join(SOUND_ROOT, 'swoosh.ogg'))

# Derived sizes
base_height = base_img.get_height() if base_img else 80
base_y = SCREEN_H - base_height


class Bird:
    def __init__(self):
        self.x = 80
        self.y = SCREEN_H // 2
        self.vel = 0.0
        self.frame = 0
        self.frame_timer = 0
        # fallback visuals
        self.radius = 14

    def flap(self):
        self.vel = FLAP_STRENGTH
        if sound_wing:
            sound_wing.play()

    def update(self, dt):
        self.vel += GRAVITY
        self.y += self.vel
        # animate
        if bird_frames:
            self.frame_timer += dt
            if self.frame_timer > 120:
                self.frame = (self.frame + 1) % len(bird_frames)
                self.frame_timer = 0

    def draw(self, surf):
        if bird_frames:
            img = bird_frames[self.frame]
            # compute rotation angle from velocity
            # negative velocity (going up) should tilt the bird up; positive (falling) tilt down
            angle = -self.vel * 3
            angle = max(-25, min(90, angle))
            rotated = pygame.transform.rotate(img, angle)
            rect = rotated.get_rect(center=(int(self.x), int(self.y)))
            surf.blit(rotated, rect)
        else:
            pygame.draw.circle(surf, (255, 215, 0), (int(self.x), int(self.y)), self.radius)

    def rect(self):
        if bird_frames:
            img = bird_frames[self.frame]
            # Use unrotated image rect for collision to keep behavior simple and stable
            r = img.get_rect(center=(int(self.x), int(self.y)))
            return r
        return pygame.Rect(self.x - self.radius, self.y - self.radius, self.radius * 2, self.radius * 2)


class Pipe:
    def __init__(self, x):
        self.x = x
        self.passed = False
        self.width = pipe_img.get_width() if pipe_img else 60
        # choose a random top pipe height (leave room for base)
        min_top = 20
        max_top = SCREEN_H - PIPE_GAP - base_height - 20
        self.top_height = random.randint(min_top, max_top)

    def update(self):
        self.x -= PIPE_SPEED

    def draw(self, surf):
        if pipe_img:
            img = pipe_img
            img_w, img_h = img.get_size()
            top_h = self.top_height
            bottom_y = self.top_height + PIPE_GAP
            bottom_h = base_y - bottom_y

            # Heuristic cap height: preserve the pipe cap instead of scaling the whole image
            cap_h = max(8, min(48, int(img_h * 0.20)))
            # ensure we don't read past the image
            body_src_y = min(img_h - 1, cap_h)

            # Draw top pipe (inverted). Draw a stretched body slice and the flipped cap.
            if top_h > 0:
                cap_draw_h = min(cap_h, top_h)
                body_h = top_h - cap_draw_h
                # draw body (use a 1px tall slice from the source and scale it)
                if body_h > 0:
                    body_slice = img.subsurface((0, body_src_y, img_w, 1))
                    body_surf = pygame.transform.scale(body_slice, (self.width, body_h))
                    body_surf = pygame.transform.flip(body_surf, False, True)
                    surf.blit(body_surf, (self.x, 0))
                # draw cap (flip vertically so it points into the gap)
                cap_slice = img.subsurface((0, 0, img_w, cap_h))
                cap_surf = pygame.transform.scale(cap_slice, (self.width, cap_draw_h))
                cap_surf = pygame.transform.flip(cap_surf, False, True)
                surf.blit(cap_surf, (self.x, top_h - cap_draw_h))

            # Draw bottom pipe. Draw cap then stretched body beneath it.
            if bottom_h > 0:
                cap_draw_h = min(cap_h, bottom_h)
                body_h = bottom_h - cap_draw_h
                # draw cap at the top of bottom pipe
                cap_slice = img.subsurface((0, 0, img_w, cap_h))
                cap_surf = pygame.transform.scale(cap_slice, (self.width, cap_draw_h))
                surf.blit(cap_surf, (self.x, bottom_y))
                # draw body below cap
                if body_h > 0:
                    body_slice = img.subsurface((0, body_src_y, img_w, 1))
                    body_surf = pygame.transform.scale(body_slice, (self.width, body_h))
                    surf.blit(body_surf, (self.x, bottom_y + cap_draw_h))
        else:
            top_rect = pygame.Rect(self.x, 0, self.width, self.top_height)
            bottom_rect = pygame.Rect(self.x, self.top_height + PIPE_GAP, self.width, SCREEN_H - (self.top_height + PIPE_GAP) - base_height)
            pygame.draw.rect(surf, (34, 139, 34), top_rect)
            pygame.draw.rect(surf, (34, 139, 34), bottom_rect)

    def collides_with(self, rect):
        top_rect = pygame.Rect(self.x, 0, self.width, self.top_height)
        bottom_rect = pygame.Rect(self.x, self.top_height + PIPE_GAP, self.width, SCREEN_H - (self.top_height + PIPE_GAP) - base_height)
        return rect.colliderect(top_rect) or rect.colliderect(bottom_rect)


def draw_ground(surf, offset=0):
    """Draw the ground (base). `offset` scrolls the base horizontally to simulate movement."""
    if base_img:
        # tile base image across width with horizontal offset
        w = base_img.get_width()
        x = -int(offset) % w
        x -= w
        while x < SCREEN_W:
            surf.blit(base_img, (x, base_y))
            x += w
    else:
        pygame.draw.rect(surf, (222, 184, 135), (0, base_y, SCREEN_W, base_height))


def draw_text_center(surf, text, font_obj, y):
    img = font_obj.render(text, True, (20, 20, 20))
    rect = img.get_rect(center=(SCREEN_W // 2, y))
    surf.blit(img, rect)


def main():
    bird = Bird()
    pipes = []
    score = 0
    running = True
    game_over = False
    base_scroll = 0.0
    BASE_SCROLL_SPEED = PIPE_SPEED  # tie base speed to pipe speed for consistent motion
    # best score persistence
    best_score_path = os.path.join(os.path.dirname(__file__), 'best_score.txt')
    try:
        with open(best_score_path, 'r') as f:
            best_score = int(f.read().strip() or 0)
    except Exception:
        best_score = 0

    # pipe spawn timer
    SPAWNPIPE = pygame.USEREVENT + 1
    pygame.time.set_timer(SPAWNPIPE, PIPE_FREQ)

    # background scaling
    if bg_img:
        bg_surf = pygame.transform.scale(bg_img, (SCREEN_W, SCREEN_H))
    else:
        bg_surf = None

    while running:
        dt = clock.tick(FPS)

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE or event.key == pygame.K_UP:
                    if game_over:
                        # restart
                        bird = Bird()
                        pipes = []
                        score = 0
                        game_over = False
                    else:
                        bird.flap()
                if event.key == pygame.K_ESCAPE:
                    running = False
            if event.type == pygame.MOUSEBUTTONDOWN:
                if not game_over:
                    bird.flap()
                else:
                    # restart on click
                    bird = Bird()
                    pipes = []
                    score = 0
                    game_over = False
            if event.type == SPAWNPIPE and not game_over:
                pipes.append(Pipe(SCREEN_W + 20))

        if not game_over:
            bird.update(dt)

            # update pipes
            for p in pipes:
                p.update()
                if not p.passed and p.x + p.width < bird.x:
                    p.passed = True
                    score += 1
                    if sound_point:
                        sound_point.play()

            # remove off-screen pipes
            pipes = [p for p in pipes if p.x + p.width > -10]

            # collisions
            bird_rect = bird.rect()
            if bird.y <= 0 or bird.y >= base_y:
                game_over = True
                if sound_die:
                    sound_die.play()
                # update best score on death
                if score > best_score:
                    best_score = score
                    try:
                        with open(best_score_path, 'w') as f:
                            f.write(str(best_score))
                    except Exception:
                        pass
            for p in pipes:
                if p.collides_with(bird_rect):
                    game_over = True
                    if sound_hit:
                        sound_hit.play()
                    # update best score on death via collision
                    if score > best_score:
                        best_score = score
                        try:
                            with open(best_score_path, 'w') as f:
                                f.write(str(best_score))
                        except Exception:
                            pass

        # draw
        if bg_surf:
            screen.blit(bg_surf, (0, 0))
        else:
            screen.fill((135, 206, 235))

        for p in pipes:
            p.draw(screen)

        # advance and draw scrolling ground (stop when game over)
        if not game_over:
            base_scroll += BASE_SCROLL_SPEED
        draw_ground(screen, base_scroll)
        bird.draw(screen)

        draw_text_center(screen, f"Score: {score}", font, 30)
        draw_text_center(screen, f"Best: {best_score}", font, 60)

        if game_over:
            draw_text_center(screen, "Game Over", big_font, SCREEN_H // 2 - 30)
            draw_text_center(screen, "Press SPACE or Click to restart", font, SCREEN_H // 2 + 20)

        pygame.display.flip()

    pygame.quit()
    sys.exit()


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        pygame.quit()
        print('Error:', e)
        raise