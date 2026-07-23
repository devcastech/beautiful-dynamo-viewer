use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AppError {
    pub message: String,
}

impl From<aws_sdk_dynamodb::Error> for AppError {
    fn from(e: aws_sdk_dynamodb::Error) -> Self {
        AppError {
            message: e.to_string(),
        }
    }
}

impl<E: std::fmt::Display, R: std::fmt::Debug> From<aws_sdk_dynamodb::error::SdkError<E, R>>
    for AppError
{
    fn from(e: aws_sdk_dynamodb::error::SdkError<E, R>) -> Self {
        AppError {
            message: e.to_string(),
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl From<tauri::Error> for AppError {
    fn from(e: tauri::Error) -> Self {
        AppError {
            message: e.to_string(),
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError {
            message: e.to_string(),
        }
    }
}

impl From<&str> for AppError {
    fn from(e: &str) -> Self {
        AppError {
            message: e.to_string(),
        }
    }
}
