# Use the official Python 3.10.8 image as the base image
FROM python:3.10.8

# Set the working directory inside the container
WORKDIR /app

# Copy the necessary files to the container
COPY main.py .
COPY main_test.py .
COPY requirements.txt .

# # Install dependencies within the virtual environment
# RUN ./venv/bin/pip install --upgrade pip \
#     && ./venv/bin/pip install -r requirements.txt
# RUN python3 -m venv venv
# RUN source venv/bin/activate
# RUN pip install -r requirements.txt

RUN pip install --upgrade pip && pip install -r requirements.txt

# Expose the port that FastAPI will run on
EXPOSE 8000

CMD fastapi run --port $PORT