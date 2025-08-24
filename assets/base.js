document.addEventListener('DOMContentLoaded', function() {
            const gameCanvas = document.getElementById('game');
            const gameCtx = gameCanvas.getContext('2d');
            const overlay = document.getElementById('overlay');
            const radiusInput = document.getElementById('radius');
            const toggleBtn = document.getElementById('toggle');
            
            // Масштаб спрайта
            const SCALE = 2;
            let radius = Number(radiusInput.value);
            let lightsEnabled = true;
            
            // Класс для создания стен/препятствий
            class Box {
                constructor(width, height, x, y) {
                    this.width = width;
                    this.height = height;
                    this.x = x;
                    this.y = y;
                    this.color = "#333";
                }
                
                draw() {
                    gameCtx.fillStyle = this.color;
                    gameCtx.fillRect(this.x, this.y, this.width, this.height);
                }
            }
            
            // Класс для скелетов
            class Skeleton {
                constructor(x, y) {
                    this.x = x;
                    this.y = y;
                    this.width = 32 * SCALE;
                    this.height = 32 * SCALE;
                    this.speed = 2;
                    this.spritesheet = 'https://i.imgur.com/fkkH3uL.png';
                    this.img = new Image();
                    this.img.src = this.spritesheet;
                    this.frame = 0;
                    this.direction = 2; // Направление (юг по умолчанию)
                    this.lightElement = null;
                    this.createLightElement();
                }
                
                createLightElement() {
                    this.lightElement = document.createElement('div');
                    this.lightElement.className = 'light';
                    this.lightElement.style.width = `${radius * 2}px`;
                    this.lightElement.style.height = `${radius * 2}px`;
                    overlay.appendChild(this.lightElement);
                }
                
                updateLightPosition() {
                    if (this.lightElement) {
                        const centerX = this.x + this.width / 2;
                        const centerY = this.y + this.height / 2;
                        this.lightElement.style.left = `${centerX}px`;
                        this.lightElement.style.top = `${centerY}px`;
                    }
                }
                
                updateLightSize() {
                    if (this.lightElement) {
                        this.lightElement.style.width = `${radius * 2}px`;
                        this.lightElement.style.height = `${radius * 2}px`;
                    }
                }
                
                update() {
                    // Простая логика движения для демонстрации
                    this.x += (Math.random() - 0.5) * this.speed;
                    this.y += (Math.random() - 0.5) * this.speed;
                    
                    // Ограничение движения в пределах canvas
                    this.x = Math.max(0, Math.min(gameCanvas.width - this.width, this.x));
                    this.y = Math.max(0, Math.min(gameCanvas.height - this.height, this.y));
                    
                    // Анимация
                    this.frame = (this.frame + 0.1) % 4;
                    
                    // Обновление позиции света
                    this.updateLightPosition();
                }
                
                draw() {
                    if (this.img.complete) {
                        gameCtx.drawImage(
                            this.img,
                            Math.floor(this.frame) * 32, this.direction * 32, 32, 32,
                            this.x, this.y, this.width, this.height
                        );
                    }
                }
            }
            
            // Создание объектов
            const skeletons = [
                new Skeleton(100, 100),
                new Skeleton(300, 200),
                new Skeleton(500, 300)
            ];
            
            const boxes = [
                new Box(100, 30, 200, 150),
                new Box(30, 100, 400, 250),
                new Box(80, 40, 600, 400)
            ];
            
            // Настройка эффекта свечения
            radiusInput.addEventListener('input', (e) => {
                radius = Number(e.target.value);
                skeletons.forEach(skeleton => skeleton.updateLightSize());
            });
            
            // Переключение эффекта свечения
            toggleBtn.addEventListener('click', () => {
                lightsEnabled = !lightsEnabled;
                if (lightsEnabled) {
                    overlay.style.display = 'block';
                    skeletons.forEach(skeleton => {
                        skeleton.lightElement.style.display = 'block';
                    });
                } else {
                    overlay.style.display = 'none';
                    skeletons.forEach(skeleton => {
                        skeleton.lightElement.style.display = 'none';
                    });
                }
            });
            
            // Игровой цикл
            function gameLoop() {
                // Очистка canvas
                gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
                
                // Отрисовка фона
                gameCtx.fillStyle = '#222';
                gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
                
                // Обновление и отрисовка объектов
                boxes.forEach(box => box.draw());
                
                skeletons.forEach(skeleton => {
                    skeleton.update();
                    skeleton.draw();
                });
                
                requestAnimationFrame(gameLoop);
            }
            
            // Запуск игрового цикла
            gameLoop();
        });
