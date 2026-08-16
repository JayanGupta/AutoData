.PHONY: setup dev test clean

setup:
	@echo "Setting up backend..."
	cd backend && python -m venv .venv
	cd backend && .venv/bin/pip install -r requirements.txt
	@echo "Setting up frontend..."
	cd frontend && npm install

dev-backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload

dev-frontend:
	cd frontend && npm run dev

dev:
	@echo "Run 'make dev-backend' and 'make dev-frontend' in separate terminals, or use docker-compose."

test:
	cd backend && .venv/bin/pytest tests/

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf backend/.venv
	rm -rf frontend/node_modules
	rm -rf frontend/.next
