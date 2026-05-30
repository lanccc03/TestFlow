import logging
from pathlib import Path

from app.config import Settings


def configure_logging(settings: Settings) -> None:
    settings.logs_dir.mkdir(parents=True, exist_ok=True)
    settings.app_log_path.touch(exist_ok=True)
    settings.execution_log_path.touch(exist_ok=True)

    _configure_file_logger("testflow.app", settings.app_log_path)
    _configure_file_logger("testflow.execution", settings.execution_log_path)


def _configure_file_logger(name: str, path: Path) -> None:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    logger.propagate = False

    for handler in list(logger.handlers):
        if getattr(handler, "_testflow_managed", False):
            logger.removeHandler(handler)
            handler.close()

    file_handler = logging.FileHandler(path)
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
    )
    file_handler._testflow_managed = True  # type: ignore[attr-defined]
    logger.addHandler(file_handler)
